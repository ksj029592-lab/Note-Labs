targetScope = 'resourceGroup'

@description('Environment name used as a suffix for resource names.')
param environmentName string

@description('Primary deployment location.')
param location string

@description('Tags applied to resources.')
param tags object = {}

@description('Container app service name used by azd service mapping.')
param appName string = 'web'

@description('Bootstrap image used only for provisioning when app image is not provided yet.')
param bootstrapImageName string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Toggle Entra token enforcement in the app.')
param entraAuthRequired bool = false

@description('Expected Entra issuer URL. Leave empty if not configured yet.')
param entraIssuer string = ''

@description('Expected Entra audience. Leave empty if not configured yet.')
param entraAudience string = ''

@description('Optional Entra JWKS URI.')
param entraJwksUri string = ''

@description('PostgreSQL admin username.')
param postgresAdminUsername string = 'notelabsadmin'

@secure()
@description('PostgreSQL admin password.')
param postgresAdminPassword string

@description('PostgreSQL database name used by this application.')
param postgresDatabaseName string = 'notelabs'

@description('Blob container for exported PDFs.')
param blobContainerName string = 'note-exports'

var suffix = toLower(uniqueString(subscription().subscriptionId, resourceGroup().id, environmentName))
var environmentNameSlug = toLower(replace(environmentName, '_', '-'))
var environmentNameCompact = replace(environmentNameSlug, '-', '')
var storageAccountName = 'st${take(environmentNameCompact, 8)}${take(suffix, 8)}'
var acrName = 'acr${take(environmentNameCompact, 10)}${take(suffix, 6)}'
var logAnalyticsName = 'log-${environmentNameSlug}'
var managedEnvironmentName = 'cae-${environmentNameSlug}'
var containerAppName = 'ca-${environmentNameSlug}-${appName}'
var postgresServerName = 'psql-${environmentNameSlug}-${take(suffix, 6)}'
var postgresServerFqdn = '${postgresServerName}.postgres.database.azure.com'
var imageName = bootstrapImageName

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: blobContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    createMode: 'Create'
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresServer
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource postgresAllowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: union(tags, {
    'azd-service-name': appName
  })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'database-url'
          #disable-next-line use-secure-value-for-secure-inputs
          value: 'postgres://${postgresAdminUsername}:${postgresAdminPassword}@${postgresServerFqdn}:5432/${postgresDatabaseName}?sslmode=require'
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: imageName
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'PORT'
              value: '80'
            }
            {
              name: 'ENTRA_AUTH_REQUIRED'
              value: string(entraAuthRequired)
            }
            {
              name: 'ENTRA_ISSUER'
              value: entraIssuer
            }
            {
              name: 'ENTRA_AUDIENCE'
              value: entraAudience
            }
            {
              name: 'ENTRA_JWKS_URI'
              value: entraJwksUri
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'AZURE_STORAGE_ACCOUNT_URL'
              value: storage.properties.primaryEndpoints.blob
            }
            {
              name: 'AZURE_BLOB_PDF_CONTAINER'
              value: blobContainerName
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.name, 'acrpull')
  scope: acr
  properties: {
    principalId: containerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalType: 'ServicePrincipal'
  }
}

resource blobDataRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, containerApp.name, 'blobdatacontributor')
  scope: storage
  properties: {
    principalId: containerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalType: 'ServicePrincipal'
  }
}

output AZURE_CONTAINER_REGISTRY_NAME string = acr.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.properties.loginServer
output AZURE_CONTAINER_APP_NAME string = containerApp.name
output AZURE_CONTAINER_APP_URL string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output AZURE_POSTGRES_SERVER_NAME string = postgresServer.name
output AZURE_STORAGE_ACCOUNT_NAME string = storage.name
