'use strict';

const ConfigureLambdaLogs = require('../lib/configureLambdaLogs');

class ServerlessConfigureLambdaLogsPlugin {
  constructor(serverless, options) {
    this.configureLogsPlugin = new ConfigureLambdaLogs(serverless, options);
    
    // Pass through hooks from the ConfigureLambdaLogs instance
    this.hooks = this.configureLogsPlugin.hooks;
  }
}

module.exports = ServerlessConfigureLambdaLogsPlugin;