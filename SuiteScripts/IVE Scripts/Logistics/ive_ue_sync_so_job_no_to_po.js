/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * @deployedto Job
 */

define(
  [
    'N/record',
    'N/redirect',
    'N/runtime',
    'N/ui/serverWidget',
    'N/ui/message'
  ],

  /**
   * @param{record} record
   */
  (
    record,
    redirect,
    runtime,
    serverWidget,
    message
  ) => {
    let _context = [];

    const writeLog =
      (level, details) => {
        let fn =
          {
            'debug': log.debug,
            'audit': log.audit,
            'error': log.error,
            'emergency': log.emergency,
          }[level];

        if (!fn) {
          throw new TypeError('Invalid level specified: ' + level);
        }

        fn(
          {
            title: _context.join(':'),
            details: details
          }
        );
      };

    const logMsg =
      (level, msg) => {
        writeLog(level, msg);
      };

    const logVal =
      (level, name, val) => {
        if (util.isObject(val) || Array.isArray(val)) {
          writeLog(level, val);
        }
        else {
          _context.push('name=' + name);
          _context.push('typeof=' + (typeof val));
          writeLog(level, val);
          _context.pop();
          _context.pop();
        }
      };

    /**
     * Defines the function definition that is executed before record is loaded.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @param {Form} scriptContext.form - Current form
     * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
     * @since 2015.2
     */
    const beforeLoad =
      (scriptContext) => {
        _context.push('beforeLoad');
        _context.push('type=' + scriptContext.type);
        _context.push('job=' + scriptContext.newRecord.getValue({ fieldId: 'tranid' }));

        logVal('audit', 'runtime.executionContext', runtime.executionContext);

        try {
          let error = false;

          if (!scriptContext) {
            return;
          }

          if (!scriptContext.request) {
            return;
          }

          if (!scriptContext.request.parameters) {
            return;
          }

          error = scriptContext.request.parameters['err'];

          if (util.isString(error) && (error.trim() !== '')) {
            let parts = error.split('|');

            scriptContext.form.addPageInitMessage(
              {
                type: message.Type.ERROR,
                title: parts[0],
                message: parts[1]
              }
            );

            let scriptField =
              scriptContext.form.addField(
                {
                  id: 'custpage_reseturlscript',
                  label: '&nbsp;',
                  type: serverWidget.FieldType.INLINEHTML
                }
              );

            scriptField.defaultValue =
              `<script>
                function resetUrl () {
                  var url = location.search.substring(1);
                  var paramStrs = url.split('&');
                  var params = [];

                  for (var s = 0 ; s < paramStrs.length ; s++)
                  {
                    var parts = paramStrs[ s ].split('=');

                    if (parts[ 0 ] !== 'err')
                    {
                      params.push(parts[ 0 ] + '=' + parts[ 1 ]);
                    }
                  }

                  url = '?' + params.join('&');

                  history.replaceState(history.state, undefined, url);
                }

                jQuery(document).ready(
                  function () {
                    resetUrl();
                  }
                );
                </script>`;
          }
        }
        catch (e) {
          logMsg('error', e);
        }
      };

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const afterSubmit =
      (scriptContext) => {
        _context.push('afterSubmit');
        _context.push('type=' + scriptContext.type);
        _context.push('job=' + scriptContext.newRecord.getValue({ fieldId: 'tranid' }));

        logVal('audit', 'runtime.executionContext', runtime.executionContext);

        try {
          logVal('debug', 'scriptContext.type', scriptContext.type);

          // N.B. scriptContext.UserEventType.XEDIT not supported as the purchase Order field value is not available on `newRecord`

          if (scriptContext.type !== scriptContext.UserEventType.EDIT) {
            // Script is not being triggered by the edit of a logistics job

            logMsg('debug', 'Aborting as triggered on type "' + scriptContext.type + '"');

            return;
          }

          let tranSubId = scriptContext.newRecord.getValue({ fieldId: 'subsidiary' });

          logVal('debug', 'tranSubId', tranSubId);

          let subsidiary = record.load({ type: record.Type.SUBSIDIARY, id: tranSubId });
          let tranSubName = subsidiary.getValue({ fieldId: 'name' });

          logVal('debug', 'tranSubName', tranSubName);

          if (tranSubName !== 'IVE - Integrated Logistics') {
            logMsg('debug', 'Aborting as triggered on subsidiary "' + tranSubName + '"');
            return;
          }

          logMsg('audit', 'Starting');

          let logisticsJobNo =
            scriptContext.newRecord.getValue(
              {
                fieldId: 'custbody_il_costing_job_number'
              }
            );

          let linkedPOId =
            scriptContext.newRecord.getValue(
              {
                fieldId: 'custbody_jcs_linkedpo'
              }
            );

          let linkedPO =
            scriptContext.newRecord.getText(
              {
                fieldId: 'custbody_jcs_linkedpo'
              }
            );
          let field = scriptContext.newRecord.getField({ fieldId: 'custbody_jcs_linkedpo' });
          let label = 'Unknown';

          logVal('debug', 'field', field);

          if (field) {
            label = field.label;
          }

          logVal('debug', 'logisticsJobNo', logisticsJobNo);
          logVal('debug', 'linkedPO', linkedPO);
          logVal('debug', 'linkedPOId', linkedPOId);

          if (!linkedPOId) {
            logMsg('error', 'The ' + label + ' job field is empty. Please select a PO and save the job again');

            redirect.toRecord(
              {
                type: record.Type.SALES_ORDER,
                id: scriptContext.newRecord.id,
                isEditMode: false,
                parameters: {
                  err: 'Unable to update PO|The ' + label + ' job field is empty. Please select a PO and save the job again'
                }
              }
            );

            return;
          }

          record.submitFields(
            {
              type: record.Type.PURCHASE_ORDER,
              id: linkedPOId,
              values: {
                'custbody_il_costing_job_number': (util.isString(logisticsJobNo) ? logisticsJobNo : '')
              }
            }
          );

          logMsg('audit', 'PO ' + linkedPO + ' updated with Job No "' + logisticsJobNo + '"');

          logMsg('audit', 'Finished');
        }
        catch (e) {
          logMsg('error', e);
        }
      };

    return { beforeLoad, afterSubmit };
  }
);