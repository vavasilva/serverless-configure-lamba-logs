# Serverless Configure Lambda Logs

A Serverless Framework plugin (compatible with version 3.40.0 and earlier) to configure AWS Lambda logging options.

## Installation

```bash
npm install --save-dev serverless-configure-lambda-logs
```

## Local Development

If you want to develop or test this plugin locally:

1. Clone this repository
2. Install it locally in your project:

```bash
# In your Serverless project directory
npm install --save-dev /path/to/serverless-configure-lambda-logs
```

## Usage

Add the plugin to your `serverless.yml` file:

```yaml
plugins:
  - serverless-configure-lambda-logs
```

### Global Configuration

Configure log options globally for all functions:

```yaml
custom:
  logs:
    format: json            # 'json' or 'text' (default is 'text')
    applicationLevel: INFO  # 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL' (default is 'ERROR')
    systemLevel: INFO       # 'DEBUG', 'INFO', 'WARN' (default is 'WARN')
    logGroup: /custom/log/group/path # Optional: specify a custom log group
```

### Per-Function Configuration

Configure log options individually for each function:

```yaml
functions:
  hello:
    handler: handler.hello
    logs:
      format: json
      applicationLevel: DEBUG
      systemLevel: DEBUG
      logGroup: /custom/log/group/path
```

## Features

- Log configuration options with automatic CloudFormation injection
- Support for text and JSON log formats
- Configurable log levels
- Updates configurations via AWS SDK
- Support for custom log groups

## Log Levels

### Application Log Levels
- TRACE: Most detailed information for debugging
- DEBUG: Detailed information for debugging
- INFO: Informational messages
- WARN: Potentially problematic situations
- ERROR: Errors that allow the application to continue
- FATAL: Severe errors that prevent the application from functioning

### System Log Levels
- DEBUG: Detailed information about the Lambda system
- INFO: General information about the Lambda system
- WARN: Warnings about the Lambda system