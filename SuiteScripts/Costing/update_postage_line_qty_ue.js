/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @name:                                       update_postage_line_qty_ue.js
 * @author:                                     Junnel C. Mercado
 * @summary:                                    This script updates the quantity to 0 for all postage items and the stream number has a value
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Mon Jan 22 2024 7:53:41 AM
 * Change Logs:
 * Date                          Author               Description
 * Mon Jan 22 2024 7:53:41 AM -- Junnel C. Mercado -- Initial Creation
 */

/**
 * @deployedto Job
 */

define(['N/record'],
  /**
* @param{record} record
*/
  (record) => {
    /**
     * Defines the function definition that is executed before record is loaded.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @param {Form} scriptContext.form - Current form
     * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
     * @since 2015.2
     */
    const beforeLoad = (scriptContext) => {

    }

    /**
     * Defines the function definition that is executed before record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const beforeSubmit = (scriptContext) => {

    }

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const afterSubmit = (scriptContext) => {
      let oldRecord = scriptContext.oldRecord;
      let newRecord = scriptContext.newRecord;
      let id = newRecord.id;
      let type = newRecord.type;
      log.emergency({
        title: 'newRecord',
        details: newRecord
      });

      let loadRecord = record.load({
        type: type,
        id: id,
        isDynamic: true
      });
      const subsidiary = loadRecord.getValue({
        fieldId: 'subsidiary'
      });
      if (subsidiary != '2') {
        return;
      };
      const jobStatus = loadRecord.getValue({
        fieldId: 'custbody_ddc_job_status'
      });
      log.emergency({
        title: 'jobStatus',
        details: jobStatus
      })

      if (jobStatus == 10 || jobStatus == 3 || jobStatus == 5 || jobStatus == 8) {
        const itemLineCount = loadRecord.getLineCount({
          sublistId: 'item'
        });
        for (let i = 0; i < itemLineCount; i++) {
          const itemCategory = loadRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_item_category',
            line: i
          });
          const streamNumber = loadRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_stream_number',
            line: i
          });
          log.emergency({
            title: 'data value: ' + i,
            details: {
              itemCategory,
              streamNumber
            }
          })
          if (itemCategory == 20 && streamNumber) {
            loadRecord.selectLine({
              sublistId: 'item',
              line: i
            })
            loadRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              line: i,
              value: 0
            });
            loadRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_billable_qty_manual',
              line: i,
              value: 0
            });
            loadRecord.commitLine({
              sublistId: 'item',
              line: i
            });
          };
        }
        loadRecord.save({
          // enableSourcing: true,
          ignoreMandatoryFields: true
        });
      } else {
        log.emergency({
          title: 'else',
          details: 'pass'
        })
        const itemLineCount = loadRecord.getLineCount({
          sublistId: 'item'
        });
        for (let i = 0; i < itemLineCount; i++) {
          const itemCategory = loadRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_item_category',
            line: i
          });
          const streamNumber = loadRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_stream_number',
            line: i
          });
          const quotedQtyExternal = loadRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_quoted_qty_external',
            line: i
          });
          log.emergency({
            title: 'data value: ' + i,
            details: {
              itemCategory,
              streamNumber
            }
          })
          if (itemCategory == 20 && streamNumber) {
            log.emergency({
              title: 'quotedQtyExternal',
              details: quotedQtyExternal
            })
            loadRecord.selectLine({
              sublistId: 'item',
              line: i
            })
            loadRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_billable_qty_manual',
              line: i,
              value: ''
            });
            loadRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              line: i,
              value: quotedQtyExternal
            });

            loadRecord.commitLine({
              sublistId: 'item',
              line: i
            });
          };
        }
        loadRecord.save({
          enableSourcing: false,
          ignoreMandatoryFields: true
        });
      }
    }

    return {
      // beforeLoad, 
      // beforeSubmit, 
      afterSubmit
    }

  });