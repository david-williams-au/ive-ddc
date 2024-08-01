/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Job
 */

define(['N/record', 'N/search', 'N/runtime', 'N/url', 'N/https'],
  function (record, search, runtime, url, https) {
    function beforeLoad(context) {
      // context.form.clientScriptModulePath = 'SuiteScripts/JCS Picking Ticket PDF/addButton_cs.js';
      context.form.clientScriptFileId = 687273;
      let { newRecord, form } = context
      let { type, id } = newRecord
      // log.emergency({
      //     title: 'context.type',
      //     details: context.type
      // })

      if (context.type == 'view') {
        if (id) {
          // let invRecord = record.load({
          //     type,
          //     id
          // })
          var invRecord = context.newRecord;
          var subsidiary = invRecord.getValue({ fieldId: 'subsidiary' });
          log.debug("subsidiary", subsidiary);
          if (subsidiary != '2') {
            return;
          }
          let customform = invRecord.getValue({ fieldId: 'customform' })

          log.debug('form', form);
          log.debug('customform', customform);
          context.form.addButton({
            id: 'custpage_button',
            label: 'Print Picking Ticket',
            functionName: 'printpage()'
          });
        }
      }

    }
    return {
      beforeLoad: beforeLoad
    }
  });