/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Job
 * @deployedto Run
 * @deployedto Run Detail
 */

define(['N/https', 'N/http', 'N/log', 'N/runtime'], function (https, http, log, runtime) {

  function afterSubmit(context) {
    var accountId = runtime.accountId;
    var environment = runtime.envType;

    var url = '';
    switch (accountId) {
      case '5281669':
        url = 'https://mq.ivegroup.com.au/mq/ddcerp/netsuite/trigger'
        break;

      case '5281669_SB2':
        url = 'https://uatmq.ivegroup.com.au/mq/ddcerp/netsuite/trigger'
        break;

      default:
        url = 'https://devmq.ivegroup.com.au/mq/ddcerp/netsuite/trigger'
        break;
    }

    var action = ''
    switch (context.type) {
      case context.UserEventType.CREATE:
        action = 'Add';
        break;

      case context.UserEventType.EDIT:
      case context.UserEventType.XEDIT:
        action = 'Edit';
        break;

      case context.UserEventType.APPROVE:
        action = (context.newRecord.type === 'salesorder' ? 'Edit' : '');
        break;
    }

    log.debug({ title: 'context.newRecord.type', details: context.newRecord.type });
    log.debug({ title: 'context.type', details: context.type });
    log.debug({ title: 'runtime.accountid', details: accountId });
    log.debug({ title: 'action', details: action });
    log.debug({ title: 'url', details: url });

    /*
      log.debug({ title: 'context.oldRecord.opsInstructions', details: context.oldRecord ? context.oldRecord.getText('custbody_ddc_ops_job_instructions_code') : 'null' });
      log.debug({ title: 'context.newRecord.opsInstructions', details: context.newRecord ? context.newRecord.getText('custbody_ddc_ops_job_instructions_code') : 'null' });
      var opsInstructionsChanged = (context.oldRecord ? context.oldRecord.getText('custbody_ddc_ops_job_instructions_code') : '') !== (context.newRecord ? context.newRecord.getText('custbody_ddc_ops_job_instructions_code') : '');
      log.debug({ title: 'opsInstructionsChanged', details: opsInstructionsChanged });
      context.newRecord.setText('custbody_ddc_tech_cx_estimate_url', '//testing/DCH');
    */

    log.debug({ title: 'Trigger', details: action != '' ? 'SENT' : 'IGNORED' });
    if (action != '') {
      var headers = ({
        'content-type': 'application/json',
        'accept': 'application/json'
      });

      var body = {
        'Company': 'Group Office',
        'DataObject': context.newRecord.type,
        'ID': String(context.newRecord.id),
        'Action': action,
        'User': runtime.getCurrentUser().email,
        'Settings': {
        }
      };

      log.debug({ title: 'headers', details: headers });
      log.debug({ title: 'body', details: body });

      var jsonBody = JSON.stringify(body);

      var response = https.post({
        url: url,
        body: jsonBody,
        headers: headers
      });

      log.debug({ title: 'trigger response', details: JSON.stringify(response) });
    }
  }

  return {
    afterSubmit: afterSubmit
  }
});