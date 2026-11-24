const { TablesDB } = require('node-appwrite');
const { Client } = require('node-appwrite');
const client = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('my-project')
  .setKey('key');
const t = new TablesDB(client);
const fnStr = t.incrementRowColumn.toString();
console.log(fnStr.substring(0, 3000));