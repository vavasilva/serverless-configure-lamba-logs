'use strict';

module.exports.hello = async (event) => {
  console.debug('Debug log'); // Visible with applicationLevel: DEBUG
  console.info('Info log');   // Visible with applicationLevel: INFO or lower
  console.warn('Warn log');   // Visible with applicationLevel: WARN or lower
  console.error('Error log'); // Visible with applicationLevel: ERROR or lower

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Hello function executed successfully!',
        input: event,
      },
    ),
  };
};

module.exports.world = async (event) => {
  console.log('Text format logs do not have specific levels');

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'World function executed successfully!',
        input: event,
      },
    ),
  };
};

module.exports.custom = async (event) => {
  console.log('This function uses a custom log group');

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Custom function executed successfully!',
        input: event,
      },
    ),
  };
};