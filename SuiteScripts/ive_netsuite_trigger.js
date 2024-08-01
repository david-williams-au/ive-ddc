/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Credit Memo
 * @deployedto Customer
 * @deployedto Employee
 * @deployedto Vendor
 * @deployedto Vendor Bill
 * @deployedto Vendor Credit
*/

define(['N/https', 'N/http', 'N/log', 'N/runtime'], function (https, http, log, runtime) {

  function afterSubmit(context) {
    var url = '';
    var action = '';
    var accountId = runtime.accountId;
    var environment = runtime.envType;

    switch (context.type) {
      case context.UserEventType.CREATE:
        action = 'Add';
        break;

      case context.UserEventType.EDIT:
      case context.UserEventType.XEDIT:
        action = 'Edit';
        break;
    }

    log.debug({ title: 'context.newRecord.type', details: context.newRecord.type });
    log.debug({ title: 'context.type', details: context.type });
    log.debug({ title: 'runtime.accountid', details: accountId });
    log.debug({ title: 'action', details: action });

    log.debug({ title: 'finance trigger', details: action != '' ? 'SENT' : 'IGNORED' });
    if (action !== '') {
      var headers = ({
        'content-type': 'application/json',
        'accept': 'application/json'
      });

      var body = {
        'Company': 'IVE Group',
        'DataObject': context.newRecord.type,
        'Action': action,
        'ID': context.newRecord.id,
        'User': runtime.getCurrentUser().email
      };

      log.debug({ title: 'headers', details: headers });
      log.debug({ title: 'body', details: body });

      var jsonBody = JSON.stringify(body);

      switch (accountId) {
        case '5281669':
          log.debug({ title: 'url', details: 'http://mq.ivegroup.com.au:8010/mq/finance/trigger/mq' });
          var response1 = http.post({
            url: 'http://mq.ivegroup.com.au:8010/mq/finance/trigger/mq',
            body: jsonBody,
            headers: headers
          });
          break;

        case '5281669_SB2':
          log.debug({ title: 'url', details: 'https://uatmq.ivegroup.com.au/mq/finance/trigger/mq' });
          var response1 = https.post({
            url: 'https://uatmq.ivegroup.com.au/mq/finance/trigger/mq',
            body: jsonBody,
            headers: headers
          });
          break;

        default:
          log.debug({ title: 'url', details: 'https://devmq.ivegroup.com.au/mq/finance/trigger/mq' });
          var response1 = https.post({
            url: 'https://devmq.ivegroup.com.au/mq/finance/trigger/mq',
            body: jsonBody,
            headers: headers
          });
          break;
      }

      log.debug({ title: 'trigger response', details: JSON.stringify(response1) });
    }
  }

  return {
    afterSubmit: afterSubmit
  }
});