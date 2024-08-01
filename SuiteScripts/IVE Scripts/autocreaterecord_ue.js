/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/*
 * @name:                                       autocreaterecord_ue.js
 * @author:                                     Rex Jean Ducusin
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Thu Jan 19 2023 1:59:50 PM
 * Change Logs:
 * Date                          Author               Description
 * Thu Jan 19 2023 1:59:50 PM -- Rex Jean Ducusin -- Initial Creation
 */

/**
 * @deployedto Job
 * @deployedto Purchase Order
 */

define(['N/record', 'N/runtime', 'N/https', 'N/url', 'N/search'],
  /**
 * @param{record} record
 * @param{runtime} runtime
 */
  (record, runtime, https, url, search) => {

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const afterSubmit = (scriptContext) => {
      let { oldRecord, newRecord } = scriptContext
      let { type, id } = newRecord
      try {
        log.debug('type', type)
        log.debug('subsidiary', newRecord.getValue({ fieldId: 'subsidiary' }))
        if (newRecord.getValue({ fieldId: 'subsidiary' }) == 11) {
          if (type == "salesorder") {
            let tranid = search.lookupFields({
              type: type,
              id: id,
              columns: ['tranid']
            }).tranid;
            log.debug('afterSubmit', "afterSubmit")
            log.debug('newRecord', newRecord)

            let script = runtime.getCurrentScript();
            let projectexpensetype = script.getParameter({ name: 'custscript_jcs_projectexpensetype' })
            let jobToPO = newRecord.getValue({ fieldId: 'job' }) || "";
            let linkedPo = newRecord.getValue({ fieldId: 'custbody_jcs_linkedpo' }) || "";

            if (jobToPO == "") {
              // Create project
              let jobId = record.create({
                type: record.Type.JOB,
                isDynamic: true,
              })
                // .setValue({ fieldId: 'customform', value: '76' })
                .setValue({ fieldId: 'customform', value: '76' })
                .setValue({ fieldId: 'subsidiary', value: newRecord.getValue({ fieldId: 'subsidiary' }) })
                .setValue({ fieldId: 'companyname', value: tranid })
                .setValue({ fieldId: 'entityid', value: tranid })
                .setValue({ fieldId: 'startdate', value: newRecord.getValue({ fieldId: 'trandate' }) })
                .setValue({ fieldId: 'schedulingmethod', value: 'FORWARD' })
                .setValue({ fieldId: 'projectexpensetype', value: projectexpensetype })
                .setValue({ fieldId: 'parent', value: newRecord.getValue({ fieldId: 'entity' }) })
                //  .setValue({ fieldId: 'custentity_atlas_svcs_mm_class', value: newRecord.getValue({ fieldId: 'class' }) })
                //  .setValue({ fieldId: 'custentityscope_of_works', value: newRecord.getValue({ fieldId: 'custbody_scope_works' }) })
                //  .setValue({ fieldId: 'custentity1', value: newRecord.getValue({ fieldId: 'custbody_proj_temp_qte' }) })
                //  .setValue({ fieldId: 'custentity_quoted_project', value: true })
                //  .setValue({ fieldId: 'custentity_quoted_amount', value: newRecord.getValue({ fieldId: 'subtotal' }) })
                //  .setValue({ fieldId: 'projectexpensetype', value: REGULAR })
                //  .setValue({ fieldId: 'allowTime', value: allowTime })
                //  .setValue({ fieldId: 'allowallresourcesfortasks', value: allowallresourcesfortasks })
                //  .setValue({ fieldId: 'limittimetoassignees', value: limittimetoassignees })
                //  .setValue({ fieldId: 'isutilizedtime', value: isutilizedtime })
                //  .setValue({ fieldId: 'isproductivetime', value: isproductivetime })
                //  .setValue({ fieldId: 'isexempttime', value: isexempttime })
                //  .setValue({ fieldId: 'allowexpenses', value: allowexpenses })
                //  .setValue({ fieldId: 'materializetime', value: materializetime })
                //  .setValue({ fieldId: 'includecrmtasksintotals', value: includecrmtasksintotals })
                //  .setValue({ fieldId: 'allowtasktimeforrsrcalloc', value: allowtasktimeforrsrcalloc })
                //  .setValue({ fieldId: 'useallocatedtimeforforecast', value: useallocatedtimeforforecast })
                //  .setValue({ fieldId: 'forecastchargerunondemand', value: forecastchargerunondemand })
                //  .setValue({ fieldId: 'timeapproval', value: timeapproval })
                //  .setValue({ fieldId: 'custentity_requestedby2', value: newRecord.getValue({ fieldId: 'custbodycustbody_proj_requested_by2' }) })
                .save({ ignoreMandatoryFields: true })
              log.debug('newRecord', tranid)

              if (jobId) {
                log.debug('New Project Id', jobId)
                jobToPO = jobId
                record.submitFields({
                  type,
                  id,
                  values: {
                    job: jobId
                  },
                  options: {
                    ignoreMandatoryFields: true
                  }
                })

              }
            }
            let vendor = script.getParameter({ name: 'custscript_jcs_vendor' })
            let item = script.getParameter({ name: 'custscript_jcs_logisticsfrieghtitem' })

            if (linkedPo == "") {
              // Create 1 purchase order
              let poId = record.create({
                type: record.Type.PURCHASE_ORDER,
                isDynamic: true,
              })
                // .setValue({ fieldId: 'customform', value: '195' })
                .setValue({ fieldId: 'customform', value: '186' })
                .setValue({ fieldId: 'entity', value: vendor })
                .setValue({ fieldId: 'subsidiary', value: newRecord.getValue({ fieldId: 'subsidiary' }) })
                // .setValue({ fieldId: 'custbody_job_no', value: id })
                .setValue({ fieldId: 'custbody_il_costing_po_job_link', value: id })
                .setValue({ fieldId: 'startdate', value: newRecord.getValue({ fieldId: 'trandate' }) })
                .setValue({ fieldId: 'custbody_il_costing_job_number', value: newRecord.getValue({ fieldId: 'custbody_il_costing_job_number' }) })
                .setValue({ fieldId: 'location', value: newRecord.getValue({ fieldId: 'location' }) })

              let lineCount = newRecord.getLineCount('item');
              log.debug('lineCount', lineCount)
              for (var i = 0; i < lineCount; i++) {
                log.debug('item', item)
                if (item != newRecord.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'item',
                  line: i
                })) {
                  poId.selectNewLine({
                    sublistId: 'item'
                  });
                  poId.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: newRecord.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'item',
                      line: i
                    })
                  })
                  log.debug('itemValue', newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                  }))
                  let itemCost = search.lookupFields({
                    type: search.Type.ITEM,
                    id: newRecord.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'item',
                      line: i
                    }),
                    columns: ['cost']
                  }).cost;
                  log.debug('itemCost', itemCost)
                  poId.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'vendorname',
                    value: newRecord.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'vendorname',
                      line: i
                    })
                  })
                  log.debug('jobToPO', jobToPO)
                  poId.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'customer',
                    value: jobToPO
                  })
                  poId.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: newRecord.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'quantity',
                      line: i
                    })
                  })
                  poId.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: itemCost
                  })
                  poId.commitLine({
                    sublistId: 'item'
                  })
                }

              }
              var poRecId = poId.save({ ignoreMandatoryFields: true })
              if (poRecId) {
                record.submitFields({
                  type,
                  id,
                  values: {
                    custbody_jcs_linkedpo: poRecId
                  },
                  options: {
                    ignoreMandatoryFields: true
                  }
                })

              }
            }


            log.debug('New PO recrdId', poRecId)
          } else if (type == "purchaseorder") {
            let { oldRecord, newRecord } = scriptContext
            let { type, id } = newRecord
            let curRec = record.load({ type: type, id: id, isDynamic: true });
            //let linkedToJob = newRecord.getValue({ fieldId: 'custbody_job_no' }) || "";
            let linkedToJob = newRecord.getValue({ fieldId: 'custbody_il_costing_po_job_link' }) || "";
            log.debug('linkedToJob', linkedToJob)
            if (linkedToJob) {

              let recordType = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: linkedToJob,
                columns: ['recordtype']
              }).recordtype;
              log.debug('recordType', recordType)
              var jobRecord = record.load({ type: recordType, id: linkedToJob, isDynamic: true });
              var jobRef = jobRecord.getValue({ fieldId: 'job' })
              let lineCount = curRec.getLineCount('item');
              log.debug('lineCount', lineCount)
              log.debug('jobRef', jobRef)
              for (var i = 0; i < lineCount; i++) {
                log.debug('i', i)
                var customer = curRec.getSublistValue({ sublistId: 'item', fieldId: 'customer', line: i })
                log.debug('customer', customer + " : " + jobRef)

                if (!customer) {
                  curRec.selectLine({
                    sublistId: 'item',
                    line: i
                  });
                  curRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'customer',
                    value: jobRef,
                    line: i
                  })
                  curRec.commitLine({ sublistId: 'item' });
                }

              }
              var curRecId = curRec.save({ ignoreMandatoryFields: true })
              log.debug('curRecId', curRecId)
            }
          }
        }

      } catch (e) {
        log.debug('afterSubmit error', e)
      }
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
      let { oldRecord, newRecord } = scriptContext
      let { type, id } = newRecord
      log.debug('beforeSubmit', "beforeSubmit")
      try {
        if (newRecord.getValue({ fieldId: 'subsidiary' } == 11)) {
          let script = runtime.getCurrentScript();
          let projectexpensetype = script.getParameter({ name: 'custscript_jcs_projectexpensetype' })
          // Create project
          let jobId = record.create({
            type: record.Type.JOB,
            isDynamic: true,
          })
            .setValue({ fieldId: 'customform', value: '76' })
            .setValue({ fieldId: 'subsidiary', value: newRecord.getValue({ fieldId: 'subsidiary' }) })
            .setValue({ fieldId: 'companyname', value: newRecord.getValue({ fieldId: 'tranid' }) })
            .setValue({ fieldId: 'startdate', value: newRecord.getValue({ fieldId: 'trandate' }) })
            .setValue({ fieldId: 'schedulingmethod', value: 'FORWARD' })
            .setValue({ fieldId: 'projectexpensetype', value: projectexpensetype })
            .setValue({ fieldId: 'parent', value: newRecord.getValue({ fieldId: 'entity' }) })

            //  .setValue({ fieldId: 'custentity_atlas_svcs_mm_class', value: newRecord.getValue({ fieldId: 'class' }) })
            //  .setValue({ fieldId: 'custentityscope_of_works', value: newRecord.getValue({ fieldId: 'custbody_scope_works' }) })
            //  .setValue({ fieldId: 'custentity1', value: newRecord.getValue({ fieldId: 'custbody_proj_temp_qte' }) })
            //  .setValue({ fieldId: 'custentity_quoted_project', value: true })
            //  .setValue({ fieldId: 'custentity_quoted_amount', value: newRecord.getValue({ fieldId: 'subtotal' }) })
            //  .setValue({ fieldId: 'projectexpensetype', value: REGULAR })
            //  .setValue({ fieldId: 'allowTime', value: allowTime })
            //  .setValue({ fieldId: 'allowallresourcesfortasks', value: allowallresourcesfortasks })
            //  .setValue({ fieldId: 'limittimetoassignees', value: limittimetoassignees })
            //  .setValue({ fieldId: 'isutilizedtime', value: isutilizedtime })
            //  .setValue({ fieldId: 'isproductivetime', value: isproductivetime })
            //  .setValue({ fieldId: 'isexempttime', value: isexempttime })
            //  .setValue({ fieldId: 'allowexpenses', value: allowexpenses })
            //  .setValue({ fieldId: 'materializetime', value: materializetime })
            //  .setValue({ fieldId: 'includecrmtasksintotals', value: includecrmtasksintotals })
            //  .setValue({ fieldId: 'allowtasktimeforrsrcalloc', value: allowtasktimeforrsrcalloc })
            //  .setValue({ fieldId: 'useallocatedtimeforforecast', value: useallocatedtimeforforecast })
            //  .setValue({ fieldId: 'forecastchargerunondemand', value: forecastchargerunondemand })
            //  .setValue({ fieldId: 'timeapproval', value: timeapproval })
            //  .setValue({ fieldId: 'custentity_requestedby2', value: newRecord.getValue({ fieldId: 'custbodycustbody_proj_requested_by2' }) })
            .save({ ignoreMandatoryFields: true })
          log.debug('New Project Id', jobId)

          if (jobId) {
            record.submitFields({
              type,
              id,
              values: {
                job: jobId
              },
              options: {
                ignoreMandatoryFields: true
              }
            })
          }
        }

      } catch (e) {
        log.debug('afterSubmit error', e.message)
      }
    }

    return { afterSubmit }

  });