/* Plugin serverless-configure-lambda-logs
 * Copyright (c) 2024 vavasilva
 * Licensed under the MIT License. See LICENSE file for details.
 */

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