/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Job
 */

define(['N/https', 'N/http', 'N/log', 'N/runtime', "N/encode"], function (https, http, log, runtime, encode) {

  function beforeSubmit(context) {
    var url = '';
    var accountId = runtime.accountId;
    var environment = runtime.envType;

    switch (accountId) {
      case '5281669':
        url = 'https://mq.ivegroup.com.au/mq/ddcerp/netsuite/jobops'
        break;

      case '5281669_SB2':
        url = 'https://uatmq.ivegroup.com.au/mq/ddcerp/netsuite/jobops'
        break;

      default:
        url = 'https://devmq.ivegroup.com.au/mq/ddcerp/netsuite/jobops'
        break;
    }

    log.debug({ title: 'context.newRecord.type', details: context.newRecord.type });
    log.debug({ title: 'context.newRecord.id', details: context.newRecord.id });
    log.debug({ title: 'context.type', details: context.type });
    log.debug({ title: 'runtime.accountid', details: accountId });
    log.debug({ title: 'url', details: url });

    /*
            log.debug({ title: 'context.oldRecord.opsInstructions', details: context.oldRecord ? context.oldRecord.getValue('custbody_ddc_ops_job_instructions_code') : 'null' });
            log.debug({ title: 'context.newRecord.opsInstructions', details: context.newRecord ? context.newRecord.getValue('custbody_ddc_ops_job_instructions_code') : 'null' });
    */
    var opsInstructionID = context.newRecord ? context.newRecord.getValue('tranid') : '';
    log.debug({ title: 'Ops Instruction ID', details: opsInstructionID });

    var jobOps = context.newRecord ? context.newRecord.getValue('custbody_ddc_ops_job_instructions_code') : '';
    var opsInstructionsChanged = (context.oldRecord ? context.oldRecord.getValue('custbody_ddc_ops_job_instructions_code') : '') !== (context.newRecord ? context.newRecord.getValue('custbody_ddc_ops_job_instructions_code') : '');
    log.debug({ title: 'opsInstructionsChanged', details: opsInstructionsChanged });

    var jobOpsLink = context.newRecord ? context.newRecord.getValue('custbody_ddc_job_ops_ins_link') : '';
    log.debug({ title: 'jobOpsLink', details: jobOpsLink });

    var createJobOps = ((opsInstructionsChanged || ((jobOpsLink === '') && (jobOps !== ''))) && (opsInstructionID !== "To Be Generated"));
    log.debug({ title: 'Create Job Ops', details: (createJobOps ? 'CREATED' : 'IGNORED') });

    if (createJobOps) {
      var auth = encode.convert({
        string: 'mq_quadient:pUfwDr<36',
        inputEncoding: encode.Encoding.UTF_8,
        outputEncoding: encode.Encoding.BASE_64
      });

      var headers = ({
        'content-type': 'application/json',
        'accept': 'application/json',
        /*				'authorization': 'Basic ' + auth */
      });

      var body = {
        'Action': jobOpsLink === "" ? 'Add' : 'Edit',
        'OpsInstructionID': opsInstructionID,
        'JobOpsInstructions': jobOps
      }

      log.debug({ title: 'headers', details: headers });
      log.debug({ title: 'body', details: body });

      var jsonBody = JSON.stringify(body);

      var response = https.post({
        url: url,
        body: jsonBody,
        headers: headers
      });

      log.debug({
        title: 'Response',
        details: JSON.stringify(response)
      });

      if (jobOpsLink === "") {
        var responseBody = JSON.parse(response.body);
        context.newRecord.setValue('custbody_ddc_job_ops_ins_link', responseBody.jobOpsFileURL);
        log.debug({ title: 'Job Ops File URL', details: responseBody.jobOpsFileURL });
        log.debug({ title: 'Job Ops File URL (saved)', details: context.newRecord.getValue('custbody_ddc_job_ops_ins_link') });
      }
    }
  }

  return {
    beforeSubmit: beforeSubmit
  }
});