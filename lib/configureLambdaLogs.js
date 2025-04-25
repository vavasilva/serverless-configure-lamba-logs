'use strict';

class ConfigureLambdaLogs {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');

    // Default log settings
    this.logDefaults = {
      format: 'text',            // 'json' or 'text' (text is the AWS default)
      applicationLevel: 'ERROR', // 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'
      systemLevel: 'WARN',       // 'DEBUG', 'INFO', 'WARN'
    };

    // Define hooks for Serverless lifecycle
    this.hooks = {
      'before:package:initialize': this.configureLogs.bind(this),
      'before:deploy:function:packageFunction': this.configureLogs.bind(this),
      'before:deploy:deploy': this.configureLogs.bind(this),
      'after:package:finalize': this.attachLoggingConfig.bind(this),
      'after:deploy:deploy': this.updateLoggingPostDeploy.bind(this),
      'after:deploy:function:deploy': this.updateFunctionLoggingPostDeploy.bind(this)
    };
  }

  // Configure logs for all functions or for a specific function
  configureLogs() {
    const service = this.serverless.service;

    // Load global log configuration (if any)
    const globalLogConfig = service.custom && service.custom.logs
      ? service.custom.logs
      : this.logDefaults;

    // Apply log configuration to each function
    const functions = service.functions;
    if (!functions) return;

    // If deploying a single function, only configure that function
    if (this.options.function) {
      const functionName = this.options.function;
      if (functions[functionName]) {
        this.configureFunction(functionName, functions[functionName], globalLogConfig);
      } else {
        this.serverless.cli.log(`Function ${functionName} not found in serverless.yml`);
      }
      return;
    }

    // Otherwise, configure all functions
    Object.keys(functions).forEach(functionName => {
      this.configureFunction(functionName, functions[functionName], globalLogConfig);
    });
  }

  // Configure a single function
  configureFunction(functionName, functionObj, globalLogConfig) {
    // Get function-specific log config (if any)
    const functionLogConfig = functionObj.logs || {};

    // Merge with global config, with function-specific taking precedence
    const mergedConfig = {
      format: functionLogConfig.format || globalLogConfig.format || this.logDefaults.format,
      applicationLevel: functionLogConfig.applicationLevel || globalLogConfig.applicationLevel || this.logDefaults.applicationLevel,
      systemLevel: functionLogConfig.systemLevel || globalLogConfig.systemLevel || this.logDefaults.systemLevel,
      logGroup: functionLogConfig.logGroup || (globalLogConfig.logGroup ? globalLogConfig.logGroup : null)
    };

    // Validate values
    mergedConfig.format = this.validateFormat(mergedConfig.format);
    mergedConfig.applicationLevel = this.validateApplicationLevel(mergedConfig.applicationLevel);
    mergedConfig.systemLevel = this.validateSystemLevel(mergedConfig.systemLevel);

    // Store the validated config for later use
    if (!functionObj.custom) functionObj.custom = {};
    functionObj.custom.validatedLogConfig = mergedConfig;

    // Make sure environment is defined
    if (!functionObj.environment) {
      functionObj.environment = {};
    }

    // Set environment variables that control logging
    functionObj.environment.AWS_LAMBDA_HANDLER_LOG_FORMAT = mergedConfig.format;
    functionObj.environment.LOG_LEVEL = mergedConfig.applicationLevel;
    functionObj.environment.AWS_LAMBDA_LOG_LEVEL = mergedConfig.systemLevel;

    // Log configuration
    this.serverless.cli.log(`Configured log format for ${functionName}: ${mergedConfig.format}`);
    this.serverless.cli.log(`Configured application log level for ${functionName}: ${mergedConfig.applicationLevel}`);
    this.serverless.cli.log(`Configured system log level for ${functionName}: ${mergedConfig.systemLevel}`);

    if (mergedConfig.logGroup) {
      this.serverless.cli.log(`Configured custom log group for ${functionName}: ${mergedConfig.logGroup}`);
    }
  }

  // Validate log format
  validateFormat(format) {
    const lowerFormat = String(format).toLowerCase();
    if (lowerFormat !== 'json' && lowerFormat !== 'text') {
      this.serverless.cli.log(`Invalid log format: ${format}. Using default: json`);
      return 'json';
    }
    return lowerFormat;
  }

  // Validate application log level
  validateApplicationLevel(level) {
    const validLevels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const upperLevel = String(level).toUpperCase();

    if (!validLevels.includes(upperLevel)) {
      this.serverless.cli.log(`Invalid application log level: ${level}. Using default: ERROR`);
      return 'ERROR';
    }

    return upperLevel;
  }

  // Validate system log level
  validateSystemLevel(level) {
    const validLevels = ['DEBUG', 'INFO', 'WARN'];
    const upperLevel = String(level).toUpperCase();

    if (!validLevels.includes(upperLevel)) {
      this.serverless.cli.log(`Invalid system log level: ${level}. Using default: WARN`);
      return 'WARN';
    }

    return upperLevel;
  }

  // Get CloudWatch log group name for a function
  getLogGroupName(functionName) {
    const functionObj = this.serverless.service.functions[functionName];
    // Check if custom log group is specified
    if (functionObj.custom && functionObj.custom.validatedLogConfig && functionObj.custom.validatedLogConfig.logGroup) {
      return functionObj.custom.validatedLogConfig.logGroup;
    }
    // Use default log group format
    return `/aws/lambda/${this.getFunctionName(functionName)}`;
  }

  // Get the resolved name for a function
  getFunctionName(functionName) {
    const functionObj = this.serverless.service.functions[functionName];
    if (functionObj.name) {
      return functionObj.name;
    }
    const service = this.serverless.service.service;
    const stage = this.serverless.service.provider.stage;
    return `${service}-${stage}-${functionName}`;
  }

  // Find CloudFormation resource for a function
  findFunctionResource(functionName) {
    const cf = this.serverless.service.provider.compiledCloudFormationTemplate;
    if (!cf || !cf.Resources) return null;

    // Look through all resources for a Lambda function with matching name
    for (const [logicalId, resource] of Object.entries(cf.Resources)) {
      if (resource.Type !== 'AWS::Lambda::Function') continue;

      // Check if this is our function by checking references and properties
      const properties = resource.Properties || {};
      const functionLogicalId = `${functionName}LambdaFunction`;

      if (logicalId === functionLogicalId) {
        return { logicalId, resource };
      }

      // Alternatively, check if the function name matches
      const resolvedName = this.getFunctionName(functionName);
      if (properties.FunctionName === resolvedName) {
        return { logicalId, resource };
      }
    }

    return null;
  }

  // After packaging, inject LoggingConfig into the CloudFormation template
  attachLoggingConfig() {
    this.serverless.cli.log('Attaching logging configuration to CloudFormation template...');

    const functions = this.serverless.service.functions;
    if (!functions) return;

    // Debug information
    this.serverless.cli.log(`Functions in serverless.yml: ${Object.keys(functions).join(', ')}`);

    // Process each function
    for (const [functionName, functionObj] of Object.entries(functions)) {
      // Find the function resource in CloudFormation
      const functionResource = this.findFunctionResource(functionName);
      if (!functionResource) {
        this.serverless.cli.log(`⚠️ Could not find CloudFormation resource for function: ${functionName}`);
        continue;
      }

      const { logicalId, resource } = functionResource;
      this.serverless.cli.log(`Found CloudFormation resource for ${functionName}: ${logicalId}`);

      // Get the validated log config (from configureLogs)
      const validatedConfig = functionObj.custom && functionObj.custom.validatedLogConfig
        ? functionObj.custom.validatedLogConfig
        : null;

      if (!validatedConfig) {
        this.serverless.cli.log(`⚠️ No validated log config found for ${functionName}`);
        continue;
      }

      // Create LoggingConfig with proper casing
      const loggingConfig = {
        LogFormat: validatedConfig.format.toLowerCase() === 'text' ? 'Text' : 'JSON',
        LogGroup: this.getLogGroupName(functionName)
      };

      // Only add log levels if format is JSON
      if (validatedConfig.format.toLowerCase() === 'json') {
        loggingConfig.ApplicationLogLevel = validatedConfig.applicationLevel.toUpperCase();
        loggingConfig.SystemLogLevel = validatedConfig.systemLevel.toUpperCase();
      }

      // Add LoggingConfig to CloudFormation resource
      resource.Properties.LoggingConfig = loggingConfig;

      this.serverless.cli.log(`✓ Added LoggingConfig to ${logicalId}: ${JSON.stringify(loggingConfig)}`);
    }
  }

  // Fallback method: Update logging config via AWS SDK after deployment
  async updateLoggingPostDeploy() {
    if (this.options.function) {
      // Single function deployment will be handled by updateFunctionLoggingPostDeploy
      return;
    }

    this.serverless.cli.log('Ensuring logging configuration is applied via AWS SDK...');

    // Get all functions
    const functions = this.serverless.service.functions;
    if (!functions) return;

    // Update each function
    for (const [functionName, functionObj] of Object.entries(functions)) {
      await this.updateFunctionLogging(functionName, functionObj);
    }
  }

  // Update logging for a single function via AWS SDK
  async updateFunctionLoggingPostDeploy() {
    if (!this.options.function) return;

    const functionName = this.options.function;
    const functionObj = this.serverless.service.functions[functionName];
    if (!functionObj) {
      this.serverless.cli.log(`Function ${functionName} not found in serverless.yml`);
      return;
    }

    await this.updateFunctionLogging(functionName, functionObj);
  }

  // Common method to update function logging
  async updateFunctionLogging(functionName, functionObj) {
    try {
      // Get validated log config from earlier phase
      const validatedConfig = functionObj.custom && functionObj.custom.validatedLogConfig;
      if (!validatedConfig) {
        this.serverless.cli.log(`⚠️ No validated log config found for ${functionName}`);
        return;
      }

      // Get the AWS Lambda service
      const awsRequest = this.provider.request.bind(this.provider);

      // Create params based on format (Text format doesn't support log levels)
      let params = {
        FunctionName: this.getFunctionName(functionName),
        LoggingConfig: {
          LogFormat: validatedConfig.format === 'text' ? 'Text' : 'JSON',
          LogGroup: this.getLogGroupName(functionName)
        }
      };

      // Only add log levels if format is JSON
      if (validatedConfig.format === 'json') {
        params.LoggingConfig.ApplicationLogLevel = validatedConfig.applicationLevel;
        params.LoggingConfig.SystemLogLevel = validatedConfig.systemLevel;
      }

      this.serverless.cli.log(`Updating logging config for ${params.FunctionName}...`);

      await awsRequest('Lambda', 'updateFunctionConfiguration', params);

      this.serverless.cli.log(`✓ Successfully updated logging config for ${params.FunctionName}`);
    } catch (error) {
      this.serverless.cli.log(`⚠️ Failed to update logging for ${functionName}: ${error.message}`);
    }
  }
}

module.exports = ConfigureLambdaLogs;