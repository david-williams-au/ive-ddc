/**
* @NApiVersion 2.1
* @NScriptType UserEventScript
* @NModuleScope Public
* /

/**
 * @name:                                       customer_rate_card_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Fri Oct 14 2022 8:26:11 AM
 * Change Logs:
 * Date                          Author               Description
 * Fri Oct 14 2022 08:26:11 AM -- Patrick Lising -- Initial Creation
 * Thu Nov 10 2022 09:35:00 AM -- Patrick Lising -- Updating logic based on KT feedback
 * Fri Nov 11 2022 11:21:00 AM -- Patrick Lising -- Adding Manual Rate validation on setting of Rate Schedule
 * Mon Nov 14 2022 09:34:22 AM -- Patrick Lising -- Added Overall Volume handling
 * Fri Nov 25 2022 03:11:22 PM -- Patrick Lising -- Added add new item scenario
 * Wed Nov 30 2022 10:11:22 AM -- Patrick Lising -- Fixed bugs on new item scenario, changed Rate Schedule message
 * Thu Jan 05 2023 09:46:22 AM -- Patrick Lising -- Fixed bugs on manual rate without quantity change
 * Fri Feb 10 2023 10:13:22 AM -- Patrick Lising -- changed manual change field from custcol_ddc_manual_rate to custcol_ddc_manual_rate_change
 * Mon Aug 29 2023 02:22:00 AM -- Junnel Mercado -- v1.1.0 - Added changes on looping item CRC data
 * Mon May 20 2024 03:00:00 PM -- Phudit Ditsakul -- Performance Optimization
*/

/**
 * @deployedto Customer Invoice
 * @deployedto Job
 * @deployedto Quote
 * @deployedto Run
 * @deployedto Run Detail
 */

define(['N/file', 'N/record', 'N/runtime', 'N/search', './lodash.js'], function (file, record, runtime, search, _) {

  //#region 📜 Enum
  const Enum = {
    Customer: {
      DDC: 1379120 // Generic DDC Customer
    },
    Item: {
      POSTAU: 16664,
      POSTOS: 16666,
    },
    Subsidiary: {
      IVEGroup: 1, // IVE Group Limited
      DDC: 2, // IVE - Data Driven Communications
    },
    User: {
      SystemAccount: 4842
    }
  }
  //#endregion

  function beforeSubmit(context) {
    let lastObjVal = {}
    const oldRecord = context.oldRecord;
    const newRecord = context.newRecord;

    //This is to prevent the script from running on Map Reduce.
    if (runtime.executionContext == runtime.ContextType.MAP_REDUCE) {
      return;
    }

    log.debug({
      title: 'Start',
      details: 'Start of Script'
    })
    //#region 📜 Estimate, Sales Order | Skip Locked Record
    if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
      let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
      if (custbody_ddc_job_locked) {
        return;
      }
    }

    //#endregion

    // //#region 📜 Run Detail | Skip Locked Record
    // if (newRecord.type == 'customrecord_ddc_run_detail' && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
    //     let parentRun = newRecord.getValue('custrecord_ddc_rd_parent_run');
    //     if (parentRun) {
    //         let custrecord_ddc_run_locked = search.lookupFields({ type: 'customrecord_ddc_run', id: parentRun, columns: ['custrecord_ddc_run_locked'] }).custrecord_ddc_run_locked;
    //         if (custrecord_ddc_run_locked) {
    //             return;
    //         }
    //     }
    //     let parentJob = newRecord.getValue('custrecord_ddc_rd_job');
    //     if (parentJob) {
    //         let custbody_ddc_job_locked = search.lookupFields({ type: 'transaction', id: parentJob, columns: ['custbody_ddc_job_locked'] }).custbody_ddc_job_locked;
    //         if (custbody_ddc_job_locked) {
    //             return;
    //         }
    //     }
    // }
    // //#endregion

    //#region 📜 Sales Order | Customer rate card updates for actual calculations. Enquiring minimum charge and updating actuals on item rates and rate schedules
    if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type)) {

      let logObj = logStart();
      let customerId = newRecord.getValue({ fieldId: 'entity' })
      let customerLookUp = search.lookupFields({ type: 'customer', id: customerId, columns: ['custentity_ddc_excl_setup_minimum', 'custentity_ddc_overall_volume_charge'] })
      let isExclude = customerLookUp.custentity_ddc_excl_setup_minimum
      let isVolumeCharge = customerLookUp.custentity_ddc_overall_volume_charge

      //check for parent rate card if no crc for current customer
      let parentCustomer = search.lookupFields({ type: 'customer', id: customerId, columns: 'parent' })
      let entityIds = []
      if (parentCustomer) {
        let parentCustomerId = parentCustomer.parent[0].value
        entityIds = [customerId, parentCustomerId, Enum.Customer.DDC]
      } else {
        entityIds = [customerId, Enum.Customer.DDC]
      }
      let parentCrcIds = getCrcId(entityIds)
      // Aug 28, 2023 v1.1.0
      // customerId
      // parentCrcIds
      // entityIds
      let dataCRCItems = loadItemCRCData({ parentCrcIds, customerId });
      lastObjVal = {
        dataCRCItems,
        parentCustomer,
        customerId,
        parentCrcIds,
        entityIds
      }
      logEnd({ logObj: logObj, message: 'beforeSubmit | No. 1' })
    }
    //#endregion

    //#region 📜 Run Detail | Run Detail Minimum Charge Logic
    if (newRecord.type === 'customrecord_ddc_run_detail' && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && oldRecord && runtime.executionContext != runtime.ContextType.SUITELET) {
      log.debug({
        title: 'Region Check',
        details: 'Region Check Passed'
      })
      let logObj = logStart();
      let currentUser = runtime.getCurrentUser();

      // Do not check jobLocked because we need to update the actual rate and actual amount.
      if ((runtime.executionContext == runtime.ContextType.WEBSERVICES) || (runtime.executionContext == runtime.ContextType.USER_INTERFACE)) {
        let runDetailJobRecord = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_job' });
        let salesOrderLookup = search.lookupFields({ type: 'salesorder', id: runDetailJobRecord, columns: ['entity', 'subsidiary'] });
        let subsidiaryValue = Object.keys(salesOrderLookup).length > 0 ? salesOrderLookup.subsidiary[0].value : ''

        if (subsidiaryValue == Enum.Subsidiary.DDC || (subsidiaryValue == Enum.Subsidiary.IVEGroup && currentUser.id == Enum.User.SystemAccount && runtime.executionContext == 'WEBSERVICES')) {
          let actualQtyCompleted = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_actual_qty_completed' });
          if (actualQtyCompleted > 0) {
            let runId = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_parent_run' })
            let itemId = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_item' })
            let jobId = search.lookupFields({ type: 'customrecord_ddc_run', id: runId, columns: 'custrecord_ddc_run_job' })
            let customerId = search.lookupFields({ type: 'salesorder', id: jobId.custrecord_ddc_run_job[0].value, columns: 'entity' })

            //check for parent rate card if no crc for current customer
            var parentCustomer = search.lookupFields({ type: 'customer', id: customerId.entity[0].value, columns: 'parent' })
            let entityIds = []
            if (parentCustomer) {
              var parentCustomerId = parentCustomer.parent[0].value
              entityIds = [customerId.entity[0].value, parentCustomerId, Enum.Customer.DDC]
            } else {
              entityIds = [customerId.entity[0].value, Enum.Customer.DDC]
            }
            var parentCrcIds = getCrcId(entityIds)
            // log.debug({
            //     title: 'crc item details paramaters',
            //     details: {
            //         customerId: customerId.entity[0].value,
            //         itemId: itemId,
            //         actualQtyCompleted: actualQtyCompleted,
            //         parentCrcIds: parentCrcIds,
            //         entityIds: entityIds
            //     }
            // })
            var runCrcDetails = getCrcItemDetails(customerId.entity[0].value, itemId, actualQtyCompleted, parentCrcIds, entityIds)
            log.debug({
              title: 'runCrcDetails',
              details: 'runCrcDetails value: ' + JSON.stringify(runCrcDetails)
            });
            if (runCrcDetails.length > 0) {
              if (runCrcDetails[0].minCharge) {
                log.debug({ title: 'is minimum charge', details: 'is minimum charge' })
                var isMinCharge = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_minimum_charge' })
                if (!(isMinCharge)) {
                  newRecord.setValue({ fieldId: 'custrecord_ddc_rd_minimum_charge', value: true })

                  var getManualRateFlag = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate_flag' });
                  if (getManualRateFlag) {
                    var getManualRate = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate' });
                    newRecord.setValue({ fieldId: 'custrecord_ddc_actual_rate', value: getManualRate });
                  } else {
                    newRecord.setValue({ fieldId: 'custrecord_ddc_actual_rate', value: runCrcDetails[0].itemRate });
                  }
                }
              } else { //update Actual Rate on Run Detail Record using CRC custrecord_ddc_actual_rate
                log.debug({ title: 'not minimum charge', details: 'not minimum charge' })
                newRecord.setValue({ fieldId: 'custrecord_ddc_rd_minimum_charge', value: false })

                var getManualRateFlag = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate_flag' });
                if (getManualRateFlag) {
                  var getManualRate = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate' });
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_rate', value: getManualRate })
                } else {
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_rate', value: runCrcDetails[0].itemRate })
                }

                // var jobRecObj = record.load({ type: 'salesorder', id: jobId.custrecord_ddc_run_job[0].value }) // 20/05/2024 Not Use
                // var lineNum = jobRecObj.findSublistLineWithValue({ sublistId: 'item', fieldId: 'item', value: itemId });
                // var jobSave = jobRecObj.save()
                // log.debug({ title: 'jobSave3', details: 'jobSave value:3 ' + jobSave })
              }

              // if the crc detail is flat fee
              if (runCrcDetails[0].flatFee) {
                //set the amount to the flat fee rate
                var getManualRateFlag = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate_flag' });
                if (getManualRateFlag) {
                  var getManualRate = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate' });
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_amount', value: getManualRate })
                } else {
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_amount', value: runCrcDetails[0].itemRate })
                }
              } else {
                let crcitemUnit = runCrcDetails[0].itemUnit;
                var getManualRateFlag = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate_flag' });
                if (getManualRateFlag) {
                  var getManualRate = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate' });
                  let actualAmountComputation = (actualQtyCompleted / crcitemUnit) * getManualRate;
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_amount', value: actualAmountComputation })
                } else {
                  let actualAmountComputation = (actualQtyCompleted / crcitemUnit) * runCrcDetails[0].itemRate;
                  //set the amount to the rate
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_amount', value: actualAmountComputation });
                }
              }
            } else {
              // Added April 15, 2024
              // if no CRC details and if manual rate flag is true
              // set the actual rate and actual amount to the manual rate
              var getManualRateFlag = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate_flag' });
              if (getManualRateFlag) {
                var getManualRate = newRecord.getValue({ fieldId: 'custrecord_ddc_rd_manual_rate' });
                if (actualQtyCompleted) {
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_rate', value: getManualRate });
                  let actualAmountComputation = (actualQtyCompleted / 1000) * getManualRate;
                  newRecord.setValue({ fieldId: 'custrecord_ddc_actual_amount', value: actualAmountComputation })
                }
              }
            }
          }
        }
        //end of Run detail minimum charge logic
        logEnd({ logObj: logObj, message: 'beforeSubmit | No. 2' })
      }
      //#endregion


      logEnd({ logObj: logObj, message: 'beforeSubmit | No. 4' })
    } else //#region 📜 Quote, Sales Order | Transactions Logic
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && oldRecord && runtime.executionContext != runtime.ContextType.SUITELET) {
        let logObj = logStart();
        let subsidiary = newRecord.getValue('subsidiary');
        if (subsidiary == Enum.Subsidiary.DDC) {
          let runManagement = newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });
          let oldLineCount = oldRecord.getLineCount({ sublistId: 'item' })
          let newLineCount = newRecord.getLineCount({ sublistId: 'item' })

          // Search Item
          let itemResults = lookupItems({ newRecord, columns: ['type', 'custitem_ddc_setup_item', 'custitem_ddc_costing_formula'] });

          //check if there are changes made to billable qty old vs new rec
          if (oldLineCount == newLineCount) {
            //#region 📜 1. No New Item Has Been Added
            let oldItemArr = []
            let newItemArr = []

            for (let i = 0; i < newLineCount; i++) {
              let oldLineKey = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i })
              let newLineKey = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i })
              let oldItemId = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
              let newItemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
              let oldBillable = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })
              let newBillable = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })
              let oldItemType = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i })
              let oldAmount = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i })
              let newItemType = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i })

              //check for misc item
              let oldMiscItem = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_miscellaneous_item', line: i })
              let newMiscItem = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_miscellaneous_item', line: i })

              let setupItem = itemResults.find(x => x.id == newItemId) || {};
              let oldStreamName = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });
              let oldWorkCentre = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i });
              let newStreamName = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });
              let newWorkCentre = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i });
              let newAmount = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });

              oldItemArr.push({
                oldLineKey: oldLineKey,
                oldItemType: oldItemType,
                oldItemId: oldItemId,
                oldBillable: oldBillable,
                setupItem: setupItem.custitem_ddc_setup_item,
                oldMiscItem: oldMiscItem,
                costingFormula: setupItem.custitem_ddc_costing_formula,
                oldStreamName,
                oldWorkCentre,
                oldAmount
              })

              newItemArr.push({
                newLineKey: newLineKey,
                newItemType: newItemType,
                newItemId: newItemId,
                newBillable: newBillable,
                setupItem: setupItem.custitem_ddc_setup_item,
                newMiscItem: newMiscItem,
                costingFormula: setupItem.custitem_ddc_costing_formula,
                newStreamName,
                newWorkCentre,
                newAmount
              })
            }

            if (oldItemArr.length > 0 && newItemArr.length > 0) {
              let customerId = newRecord.getValue({ fieldId: 'entity' })

              let customerLookUp = search.lookupFields({
                type: 'customer',
                id: customerId,
                columns: ['custentity_ddc_excl_setup_minimum', 'custentity_ddc_overall_volume_charge']
              })

              let isExclude = customerLookUp.custentity_ddc_excl_setup_minimum
              let isVolumeCharge = customerLookUp.custentity_ddc_overall_volume_charge

              //check for parent rate card if no crc for current customer
              let parentCustomer = search.lookupFields({
                type: 'customer',
                id: customerId,
                columns: 'parent'
              })
              let entityIds = []
              if (parentCustomer) {
                let parentCustomerId = parentCustomer.parent[0].value
                entityIds = [customerId, parentCustomerId, Enum.Customer.DDC]
              } else {
                entityIds = [customerId, Enum.Customer.DDC]
              }
              let parentCrcIds = getCrcId(entityIds)

              // Aug 28, 2023 v1.1.0
              // customerId
              // parentCrcIds
              // entityIds
              let dataCRCItems = loadItemCRCData({ parentCrcIds, customerId });
              lastObjVal = {
                dataCRCItems,
                parentCustomer,
                customerId,
                parentCrcIds,
                entityIds
              }

              for (let j = 0; j < newItemArr.length; j++) {
                //do not continue if misc item
                if (newItemArr[j].newMiscItem == false) {

                  let lineNum = newRecord.findSublistLineWithValue({ sublistId: 'item', fieldId: 'lineuniquekey', value: newItemArr[j].newLineKey });
                  let inventoryType = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: lineNum });

                  //If work centre and stream name is empty and runs created is true, do not continue
                  let streamName = newItemArr[j].newStreamName;
                  let workCentre = newItemArr[j].newWorkCentre;
                  if (runManagement && streamName && workCentre && inventoryType != 'InvtPart') {
                    let ddcRollUpAmount = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rollup_amount', line: lineNum });
                    let ddcCrcRateStorage = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate_storage', line: lineNum });
                    let billableQty = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum });
                    let computeRate = billableQty > 0 ? ddcRollUpAmount / billableQty : 0;
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: computeRate });
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: ddcRollUpAmount });
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: ddcCrcRateStorage });
                    // continue;
                  } else {
                    //if customer has exclude setup when minimum, remove setup item if item after it meets minimum charge qty
                    if (isExclude) {
                      if (newItemArr[j].setupItem) {
                        var nextItemId = newItemArr[j + 1].newItemId
                        var nextNewBillableQty = parseFloat(newItemArr[j + 1].newBillable)
                        var setupItemDetails = getCrcItemDetails(customerId, nextItemId, nextNewBillableQty, parentCrcIds, entityIds)

                        let itemResult = itemResults.find(x => x.id == nextItemId) || {};
                        let itemType = itemResult.type;

                        //if InvPart, no need to check minCharge
                        if (itemType == 'Service' && !(isVolumeCharge)) {
                          if (setupItemDetails[0].minCharge) {
                            //set setup item qty to 0 if mincharge is true
                            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum, value: 0 });
                            continue;
                          }
                        }
                      }
                    }

                    //only handle items where billable qty was changed
                    if (oldItemArr[j].oldBillable != newItemArr[j].newBillable) {
                      var itemId = newItemArr[j].newItemId
                      var newBillableQty = parseFloat(newItemArr[j].newBillable)
                      // log.debug({
                      //     title: 'itemId',
                      //     details: 'itemId billable quantity was changed: ' + itemId
                      // })

                      //get customer rate card details of current customer on Job
                      if (itemId != -3) {//skip description item
                        if (newItemArr[j].newItemType != 'Description' && (newItemArr[j].newItemType == 'Service' || newItemArr[j].newItemType == "NonInvtPart" || newItemArr[j].newItemType == "InvtPart")) {
                          var crcItemDetails = getCrcItemDetails(customerId, itemId, newBillableQty, parentCrcIds, entityIds)
                          // log.emergency({
                          //     title: 'getCrcItemDetails 3',
                          //     details: crcItemDetails
                          // });
                          var manualRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: lineNum });
                          var billableQty = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum });
                          var rate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum });
                          if (!rate) {
                            rate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum });
                          }
                          var unit = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: lineNum });
                          if (manualRate) {
                            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: (billableQty * rate) / unit });
                            continue;
                          }
                          //if no CRC details or item is inventory part, set rate to 0
                          if (crcItemDetails.length == 0) {
                            if (!manualRate) {
                              log.debug({ title: `rate pass 1 ${lineNum}`, details: `rate pass 1` });
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: 0 });
                            }
                          } else {
                            //get manual rate
                            var manualRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: lineNum });
                            // //16_06_2023
                            if (newItemArr[j].costingFormula.length > 0) {
                              //if (!manualRate && newItemArr[j].costingFormula[0].value != 9) {
                              if (!manualRate) {
                                log.debug({ title: `rate pass 2 ${lineNum}`, details: crcItemDetails[0].itemRate });
                                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: crcItemDetails[0].itemRate });
                                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: crcItemDetails[0].itemRate });
                                // Add 15_11_2023
                                var itemUnit = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: lineNum });
                                if (itemUnit == '1000') {
                                  var qty = parseFloat(newItemArr[j].newBillable) / 1000
                                  // log.debug({
                                  //     title: 'quantity not updated, itemUnit == 1000',
                                  //     details: qty
                                  // })
                                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: qty * (crcItemDetails[0].itemRate) });
                                  if (newItemArr[j].newBillable == 0) {
                                    log.debug({ title: `rate pass 3.1 ${lineNum}`, details: 'rate pass 3' });
                                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                                  } else {
                                    log.debug({ title: `rate pass 3.2 ${lineNum}`, details: qty * (crcItemDetails[0].itemRate) });
                                    newRecord.setSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'rate', // TODO January 26, 2024 - check if this is correct
                                      line: lineNum,
                                      value: qty * (crcItemDetails[0].itemRate)
                                    });
                                  }
                                } else {
                                  // log.debug({
                                  //     title: 'quantity not updated, itemUnit !=1000',
                                  //     details: qty
                                  // })
                                  var qty = parseFloat(newItemArr[j].newBillable) / itemUnit
                                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: qty * (crcItemDetails[0].itemRate) });
                                  if (newItemArr[j].newBillable == 0) {
                                    log.debug({ title: `rate pass 4.1 ${lineNum}`, details: 'rate pass 4' });
                                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                                  } else {
                                    log.debug({ title: `rate pass 4.2 ${lineNum}`, details: qty * (crcItemDetails[0].itemRate) });
                                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: qty * (crcItemDetails[0].itemRate) });
                                  }
                                }
                              }
                            } else {
                              log.debug({ title: `rate pass 5 ${lineNum}`, details: `rate pass 5` });
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: 0 });
                            }

                            if (crcItemDetails[0].flatFee) {
                              //if flat rate is true, set rate from rate card to amount
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: crcItemDetails[0].itemRate });

                            } else if (crcItemDetails[0].itemUnit != '1000' && !(crcItemDetails[0].flatFee) && !(crcItemDetails[0].minCharge)) {
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });

                            } else if (crcItemDetails[0].itemUnit == '1000' && !(crcItemDetails[0].flatFee) && !(crcItemDetails[0].minCharge)) {

                              // log.debug({
                              //     title: 'itemUnit == 1000',
                              //     details: 'itemUnit == 1,000. newBillableQty = ' + newBillableQty
                              // })

                              if (newBillableQty >= 1000) {
                                newBillableQty = newBillableQty / 1000

                                // log.debug({
                                //     title: 'newBillableQty >= 1000',
                                //     details: 'newBillableQty >= 1000. newBillableQty = ' + newBillableQty
                                // })

                                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });
                                //16_06_2023

                                if (newItemArr[j].costingFormula.length > 0) {
                                  if (!manualRate && newItemArr[j].costingFormula[0].value) {
                                    // log.debug({
                                    //     title: '!manualRate',
                                    //     details: 'set amount to: crcItemDetails[0].itemRate * newBillableQty'
                                    // })
                                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: crcItemDetails[0].itemRate * newBillableQty });

                                  } else {
                                    // log.debug({ title: 'manualRate is true', details: 'set amount to: newRate * newBillableQty' })
                                    var newRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum });
                                    if (!newRate) {
                                      newRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum });
                                    }
                                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: newRate * newBillableQty });
                                  }
                                }
                                else {
                                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: 0 });
                                }
                              }
                            }
                          }
                        } else {
                          // log.emergency({ title: 'itemType is not Service', details: 'itemType is not Service' });
                          log.debug({ title: `rate pass 6 ${lineNum}`, details: `rate pass 6` })
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: 0 });
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: 0 });
                        }
                      }
                    } else { // still check manual rate even if qty is not updated
                      var itemId = newItemArr[j].newItemId
                      // log.debug({
                      //     title: 'itemId quantity not updated',
                      //     details: 'itemId: ' + itemId
                      // })

                      if (itemId != -3) {//skip description item
                        if (newItemArr[j].newItemType != 'Description' && ((newItemArr[j].newItemType == 'Service' || newItemArr[j].newItemType == "NonInvtPart" || newItemArr[j].newItemType == "InvtPart"))) {
                          //J add 13_07
                          var newBillableQty = newItemArr[j].newBillable
                          //var crcItemDetails = getCrcItemDetails(customerId, itemId, newBillableQty, parentCrcIds, entityIds);
                          var crcItemDetails = dataCRCItems.filter(val => {
                            return val.item == itemId
                          });
                          crcItemDetails = checkBillableQty(crcItemDetails, newBillableQty)
                          // log.emergency({
                          //     title: 'getCrcItemDetails details 4',
                          //     details: {
                          //         customerId, // one time load
                          //         itemId, // from item line
                          //         newBillableQty, // from item line
                          //         parentCrcIds, // one time load
                          //         entityIds // one time load
                          //     }
                          // });
                          // log.audit({
                          //     title: 'getCrcItemDetails details 4',
                          //     details: {
                          //         customerId, // one time load                                                  
                          //         parentCrcIds, // one time load
                          //         entityIds // one time load
                          //     }
                          // });

                          if (crcItemDetails.length > 0) {
                            if (newItemArr[j].newItemType == 'Service') {
                              var workCenter = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: lineNum, });
                              if (!workCenter) {
                                if ((parseFloat(crcItemDetails[0].fromQty) < parseFloat(newBillableQty)) && (parseFloat(crcItemDetails[0].toQty) > parseFloat(newBillableQty)) && (crcItemDetails[0].minCharge == true)) {
                                  // log.emergency({
                                  //     title: `min charge tracking 3 ${lineNum}`,
                                  //     details: 'min charge tracking 3'
                                  // })
                                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_minimum_charge_count', line: lineNum, value: 1 });
                                }
                                else {
                                  // log.emergency({
                                  //     title: `min charge tracking 4 ${lineNum}`,
                                  //     details: 'min charge tracking 4'
                                  // })
                                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_minimum_charge_count', line: lineNum, value: '' });
                                }
                              }
                            }
                          }

                          //get manual rate
                          var manualRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: lineNum });
                          if (!manualRate && newItemArr[j].costingFormula.length == 0) {
                            continue;
                          }
                          var itemUnit = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: lineNum });
                          var newRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum });
                          if (!newRate) {
                            newRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum });
                            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: newRate });
                          }

                          if (itemUnit == '1000') {
                            var qty = parseFloat(newItemArr[j].newBillable) / 1000

                            // log.debug({
                            //     title: 'quantity not updated, itemUnit == 1000',
                            //     details: qty
                            // })
                            var amountCompute = qty * newRate
                            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: amountCompute });

                            if (newItemArr[j].newBillable == 0) {
                              log.debug({ title: `rate pass 7.1 ${lineNum}`, details: 'rate pass 7' })
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                            }
                            else {
                              log.debug({ title: `rate pass 7.2 ${lineNum}`, details: amountCompute / qty })
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: amountCompute / qty });
                            }
                          }
                          else {
                            // log.debug({
                            //     title: 'quantity not updated, itemUnit !=1000',
                            //     details: qty
                            // });
                            itemUnit = !itemUnit ? 1 : itemUnit

                            var qty = parseFloat(newItemArr[j].newBillable) / itemUnit
                            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: qty * newRate });
                            if (newItemArr[j].newBillable == 0) {
                              log.debug({ title: `rate pass 8.1 ${lineNum}`, details: 'rate pass 8' })
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                            }
                            else {
                              let amountCompute = qty * newRate
                              log.debug({
                                title: `rate pass 8.2 ${lineNum}`,
                                details: {
                                  qty,
                                  newRate,
                                  computed_amount: qty * newRate
                                }
                              })
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: amountCompute || 0 });
                            }
                          }
                          if (crcItemDetails.length > 0) {
                            if (crcItemDetails[0].flatFee) {
                              //if flat rate is true, set rate from rate card to amount
                              // log.debug({
                              //     title: 'crcItemDetails[0].flatFee',
                              //     details: 'crcItemDetails[0].flatFee value: ' + crcItemDetails[0].flatFee
                              // })
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: crcItemDetails[0].itemRate });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            //#endregion
          } else if (newLineCount > oldLineCount) {
            //#region 📜 2. New Item Has Been Added
            let oldItemArr = []
            let newItemArr = []

            for (let i = 0; i < newLineCount; i++) {
              let oldLineKey = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i })
              let newLineKey = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i })
              let oldItemId = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
              let newItemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
              let oldBillable = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })
              let newBillable = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })
              let oldItemType = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i })
              let newItemType = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i })

              //check for misc item
              let oldMiscItem = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_miscellaneous_item', line: i })
              let newMiscItem = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_miscellaneous_item', line: i })
              let setupItem = itemResults.find(x => x.id == newItemId) || {};

              oldItemArr.push({
                oldLineKey: oldLineKey,
                oldItemType: oldItemType,
                oldItemId: oldItemId,
                oldBillable: oldBillable,
                setupItem: setupItem.custitem_ddc_setup_item,
                oldMiscItem: oldMiscItem,
                costingFormula: setupItem.custitem_ddc_costing_formula
              })

              newItemArr.push({
                newLineKey: newLineKey,
                newItemType: newItemType,
                newItemId: newItemId,
                newBillable: newBillable,
                setupItem: setupItem.custitem_ddc_setup_item,
                newMiscItem: newMiscItem,
                costingFormula: setupItem.custitem_ddc_costing_formula
              })
            }

            let addedItemsArr = newItemArr.filter(({ newLineKey: id1 }) => !oldItemArr.some(({ oldLineKey: id2 }) => id2 === id1)); //get the newly added items from newItemArr

            // log.debug({
            //     title: 'array lengths',
            //     details: 'addedItemsArr value: ' + addedItemsArr.length + ' newItemArr value: ' + newItemArr.length + ' oldItemArr value: ' + oldItemArr.length
            // })

            if (addedItemsArr.length > 0) {
              let customerId = newRecord.getValue({ fieldId: 'entity' })
              let customerLookUp = search.lookupFields({
                type: 'customer',
                id: customerId,
                columns: ['custentity_ddc_excl_setup_minimum', 'custentity_ddc_overall_volume_charge']
              })

              let isExclude = customerLookUp.custentity_ddc_excl_setup_minimum
              let isVolumeCharge = customerLookUp.custentity_ddc_overall_volume_charge

              //check for parent rate card if no crc for current customer
              let parentCustomer = search.lookupFields({
                type: 'customer',
                id: customerId,
                columns: 'parent'
              })

              let entityIds = []
              if (parentCustomer) {
                let parentCustomerId = parentCustomer.parent[0].value
                entityIds = [customerId, parentCustomerId, Enum.Customer.DDC]
              } else {
                entityIds = [customerId, Enum.Customer.DDC]
              }
              let parentCrcIds = getCrcId(entityIds)

              for (let j = 0; j < addedItemsArr.length; j++) {
                if (addedItemsArr[j].newMiscItem == false) {
                  if (addedItemsArr[j].newItemId != -3) { //skip description item
                    if (addedItemsArr[j].newItemType != 'Description' && addedItemsArr[j].newItemType == 'Service') {
                      //if customer has exclude setup when minimum, remove setup item if item after it meets minimum charge qty

                      //get line number, start from the last added item
                      var lineCtr = j + 1;

                      var lineNum = newLineCount - lineCtr
                      if (isExclude) {
                        if (addedItemsArr[j].setupItem) {
                          var nextItemId = addedItemsArr[j + 1].newItemId
                          var nextNewBillableQty = parseFloat(addedItemsArr[j + 1].newBillable)
                          var setupItemDetails = getCrcItemDetails(customerId, nextItemId, nextNewBillableQty, parentCrcIds, entityIds)
                          // log.emergency({
                          //     title: 'getCrcItemDetails 5',
                          //     details: setupItemDetails
                          // });
                          let itemResult = itemResults.find(x => x.id == nextItemId) || {};
                          let itemType = itemResult.type;
                          //if InvPart, no need to check minCharge
                          if (itemType == 'Service' && !(isVolumeCharge)) {
                            if (setupItemDetails[0].minCharge) {
                              // newRecord.removeLine({
                              //     sublistId: 'item',
                              //     line: lineNum
                              // });

                              //set setup item qty to 0 if mincharge is true
                              // log.debug({ title: 'minCh nextItemId', details: 'setup item qty set to 0 due to minCharge' })
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum, value: 0 });
                              continue;
                            }
                          }
                        }
                      }

                      // var itemId = addedItemsArr[j].newItemId
                      var newBillableQty = parseFloat(addedItemsArr[j].newBillable)

                      var itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: lineNum });
                      //J add 02_08_2023
                      var manalRateLine = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: lineNum });
                      if (manalRateLine) {
                        continue;
                      }
                      //get customer rate card details of current customer on Job

                      var crcItemDetails = getCrcItemDetails(customerId, itemId, newBillableQty, parentCrcIds, entityIds)
                      // log.emergency({
                      //     title: 'getCrcItemDetails 6',
                      //     details: crcItemDetails
                      // });
                      // log.debug({
                      //     title: 'crcItemDetails',
                      //     details: 'crcItemDetails value: ' + JSON.stringify(crcItemDetails)
                      // })

                      if (crcItemDetails.length == 0) {
                        log.debug({ title: `rate pass 9 ${lineNum}`, details: `rate pass 9` })
                        newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                        newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: 0 });

                      } else {

                        var manualRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: lineNum });

                        // log.debug({
                        //     title: 'addedItemsArr',
                        //     details: 'addedItemsArr value: ' + JSON.stringify(addedItemsArr)
                        // })

                        if (!manualRate && addedItemsArr[j].costingFormula[0].value != 9) {
                          // log.debug({
                          //     title: '!manualRate && addedItemsArr[j].costingFormula[0].value != 9',
                          //     details: 'true'
                          // })
                          log.debug({ title: `rate pass 10 ${lineNum}`, details: crcItemDetails[0].itemRate })
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: crcItemDetails[0].itemRate });
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: crcItemDetails[0].itemRate });
                        }

                        if (crcItemDetails[0].flatFee) {
                          //if flat rate is true, set rate from rate card to amount
                          // log.debug({
                          //     title: 'crcItemDetails[0].flatFee',
                          //     details: 'crcItemDetails[0].flatFee value: ' + crcItemDetails[0].flatFee
                          // })
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });
                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: crcItemDetails[0].itemRate });

                        } else if (crcItemDetails[0].itemUnit != '1000' && !(crcItemDetails[0].flatFee) && !(crcItemDetails[0].minCharge)) {

                          newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });

                        } else if (crcItemDetails[0].itemUnit == '1000' && !(crcItemDetails[0].flatFee) && !(crcItemDetails[0].minCharge)) {

                          // log.debug({
                          //     title: 'itemUnit == 1000',
                          //     details: 'itemUnit == 1,000. newBillableQty = ' + newBillableQty
                          // })

                          if (newBillableQty >= 1000) {
                            newBillableQty = newBillableQty / 1000

                            // log.debug({
                            //     title: 'newBillableQty >= 1000',
                            //     details: 'newBillableQty >= 1000. newBillableQty = ' + newBillableQty
                            // })

                            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: crcItemDetails[0].itemRate });

                            if (!manualRate && addedItemsArr[j].costingFormula[0].value != 9) {
                              // log.debug({
                              //     title: '!manualRate',
                              //     details: 'set amount to: ' + crcItemDetails[0].itemRate * newBillableQty
                              // })

                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: crcItemDetails[0].itemRate * newBillableQty });

                            } else {

                              // log.debug({
                              //     title: 'manualRate is true',
                              //     details: 'set amount to: ' + newRate * newBillableQty
                              // })

                              var newRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum });
                              if (!newRate) {
                                newRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum });
                              }
                              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: newRate * newBillableQty });
                            }
                          }
                        }
                      }
                    } else {
                      //bug 
                      // newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: 0 });
                    }
                  }
                }
              }
            }
            //#endregion
          } // end of newLine > oldLine
        }// end of transactions logic
        logEnd({ logObj: logObj, message: 'beforeSubmit | No. 3' })
      }
    //#endregion

    //#region 📜 Quote, Sales Order | CRC Fix for Manual Rate Change
    // Run if the transaction is a Sales Order
    // March 11,2023 Added in Estimate to fix the CRC issue on the Quote record
    // - This was originally only to trigger on Sales Order but was added to Estimate to fix the CRC issue on the Quote record
    // log.debug({
    //     title: 'Entry Point for CRC Fix for Manual Rate Change',
    //     details: {
    //         type: newRecord.type,
    //         contextType: context.type,
    //         executionContext: runtime.executionContext
    //     }
    // });

    const postaItemData = searchPostageItems()

    if (
      (
        [record.Type.SALES_ORDER].includes(newRecord.type)
        && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type)
        // && runtime.executionContext != runtime.ContextType.SUITELET
      )
      ||
      (
        [record.Type.ESTIMATE].includes(newRecord.type)
        && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type)
        && runtime.executionContext != runtime.ContextType.SUITELET
      )
    ) {
      let logObj = logStart();


      // January 18, 2023 
      // CRC Fix for Manual Rate Change

      // if object is empty return
      if (Object.keys(lastObjVal).length > 0) {
        var parentCrcIds = lastObjVal.parentCrcIds;
        var customerId = parseFloatOrZero(lastObjVal.customerId);
        var parentId = lastObjVal.parentCustomer;
        parentId = parentId.parent.length > 0 ? parseFloatOrZero(parentId.parent[0].value) : '';
        let dataCRCItems = loadItemCRCData({ parentCrcIds, customerId });
        let runManagement = newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });

        let newLineCount = newRecord.getLineCount({ sublistId: 'item' });
        // createTextFile('dataCRCItems', JSON.stringify(dataCRCItems));

        for (var i = 0; i < newLineCount; i++) {
          // Get manual rate change
          let manualRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: i });
          let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
          let billableQty = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
          let crcRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: i });
          let ddcRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: i });
          let unitRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: i }) || 1;
          let itemType = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
          let streamName = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });
          let workCentre = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i });
          let amount = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });

          if (!postaItemData.includes(itemId)) {

            log.emergency({
              title: `Line Item CDC ${i + 1}`,
              details: {
                itemType,
                manualRate,
                itemId,
                billableQty,
                crcRate,
                ddcRate,
                unitRate,
                runManagement,
                streamName,
                workCentre,
                amount
              }
            });

            if (runManagement && streamName && workCentre && itemType != 'InvtPart') {
              let ddcRollUpAmount = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rollup_amount', line: i }) || 0;
              let ddcCrcRateStorage = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate_storage', line: i }) || 0;

              let computeRate = billableQty > 0 ? ddcRollUpAmount / billableQty : 0;
              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: computeRate });
              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: ddcRollUpAmount });
              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: i, value: ddcCrcRateStorage });

            } else {
              if (itemType == 'Service' || itemType == 'NonInvtPart' || itemType == 'InvtPart') { // Only run for transactions
                // let findItem = dataCRCItems.find((item) => {
                //     if (item.item == itemId && inRange(billableQty, item.fromQty, item.toQty)) { // && billableQty == item.fromQty
                //         return item
                //     }
                // });

                //Change find to filter due to hierarchy choosing the first item
                let filterItems = dataCRCItems.filter((item) => {
                  if (item.item == itemId) { // && billableQty == item.fromQty
                    return item
                  }
                });

                // log.emergency({
                //     title: 'customIds',
                //     details: {
                //         parentCrcIds,
                //         customerId,
                //         parentId
                //     }
                // });
                log.debug({
                  title: 'filterItems',
                  details: filterItems
                })
                // Find related parent, item and range quantity amount based on the hierarchy
                let findItem = filterItems.find((item) => {
                  log.debug({
                    title: 'item',
                    details: item
                  })
                  if (item.parent == parentCrcIds[customerId] && item.item == itemId && inRange(billableQty, item.fromQty, item.toQty)) { // Filter find first current Customer
                    return item
                  } else if (item.parent == parentCrcIds[parentId] && item.item == itemId && inRange(billableQty, item.fromQty, item.toQty)) { // Else find parent Customer
                    return item
                  } else if (item.parent == parentCrcIds[Enum.Customer.DDC] && item.item == itemId && inRange(billableQty, item.fromQty, item.toQty)) {
                    return item
                  }
                });

                // If no item found, get the first item in the filter. This is usually the child customer or parent or generic customers based on the hierarchy
                // This was added because a scenario for from quantity Null and to quantity 0 was not found in the CRC
                if (!findItem || findItem == undefined) {
                  if (filterItems.length > 0) {
                    findItem = filterItems[0];
                  }
                }

                // If still no item found, set the findItem to default values
                if (!findItem) {
                  // log.debug(`Cannot find item in Line Item CDC ${i + 1}`);
                  findItem = {
                    flatFee: false,
                    itemRate: 0,
                    minCharge: false,
                    toQty: 0
                  }
                }

                // If Manual Rate is true, use the CRC Rate
                if (manualRate) {
                  let checkRangeQuantity = inRange(billableQty, findItem.fromQty, findItem.toQty);
                  if (checkRangeQuantity) { // if its in range
                    if (findItem.minCharge) {
                      let rate = ddcRate / billableQty;
                      // log.emergency({
                      //     title: 'rate min charge true and within range',
                      //     details: rate
                      // })
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: rate || 0, ignoreFieldChange: false });
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: ddcRate || 0, ignoreFieldChange: false });
                    } else {
                      let computeAmountRate = billableQty / unitRate * ddcRate;
                      let rate = computeAmountRate / billableQty;
                      // log.emergency({
                      //     title: 'computation else checkrangequantity true',
                      //     details: {
                      //         computeAmountRate,
                      //         rate
                      //     }
                      // })
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: rate || 0, ignoreFieldChange: false });
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: computeAmountRate || 0, ignoreFieldChange: true });
                      // log.emergency({
                      //     title: 'false computation for min charge',
                      //     details: {
                      //         rate,
                      //         amount: computeAmountRate
                      //     }
                      // })
                    }
                  } else {
                    // log.emergency({
                    //     title: 'checkRangeQuantity false',
                    //     details: 'checkRangeQuantity false'
                    // });

                    if (billableQty == 0) {
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: 0, ignoreFieldChange: false });
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: 0, ignoreFieldChange: false });
                    } else {
                      if (findItem.flatFee == false) {
                        let computeAmountRate = billableQty / unitRate * ddcRate;
                        let rate = computeAmountRate / billableQty;
                        // log.emergency({
                        //     title: 'computation else checkrangequantity false',
                        //     details: {
                        //         rate,
                        //         amount: computeAmountRate
                        //     }
                        // })
                        newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: rate || 0, ignoreFieldChange: false });
                        newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: computeAmountRate, ignoreFieldChange: true });
                      } else {

                      }
                    }
                  }
                } else {
                  // log.emergency({
                  //     title: 'manualRate',
                  //     details: manualRate
                  // });
                  // let findItem = dataCRCItems.find(item => item.item == itemId);
                  if (billableQty == 0) { // If Billable Quantity is 0 then set the rate and amount to 0
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: 0, ignoreFieldChange: false });
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: 0, ignoreFieldChange: false });
                  } else { // If Billable Quantity is not 0 then compute the rate and amount based on the founded CRC custom record
                    if (findItem.flatFee == true) {
                      let computeAmountRate = parseFloatOrZero(findItem.itemRate);
                      let rate = computeAmountRate / billableQty;
                      rate = rate || 0
                      // log.emergency({
                      //     title: 'else flatFee true',
                      //     details: {
                      //         rate,
                      //         amount: computeAmountRate
                      //     }
                      // });
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: rate, ignoreFieldChange: false });
                      // log.emergency({
                      //     title: 'pass to amount',
                      //     details: computeAmountRate
                      // })
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: computeAmountRate, ignoreFieldChange: true });
                    } else {
                      let rateCheck = findItem != '' ? findItem.itemRate : 0; // Check if Item exists first because object sometimes return null
                      let computeAmountRate = billableQty / unitRate * rateCheck;

                      // log.emergency({
                      //     title: 'else flatFee false',
                      //     details: {
                      //         rate: rateCheck,
                      //         amount: computeAmountRate
                      //     }
                      // })
                      let rate = computeAmountRate / billableQty;
                      rate = !rate ? 0 : rate; // Having issues because the rate variable above is dividing to NaN.
                      // log.emergency({
                      //     title: 'rate false',
                      //     details: rate
                      // })
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: rate, ignoreFieldChange: false });
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: i, value: computeAmountRate || 0, ignoreFieldChange: true });
                    }
                  };
                  // log.debug({
                  //     title: 'findItem',
                  //     details: findItem
                  // });
                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: i, value: findItem.itemRate });
                }

                // log.emergency({
                //     title: 'findItem after checking manual rate process',
                //     details: findItem
                // });
                if (!runManagement) {
                  if (findItem.minCharge) {
                    // log.emergency({
                    //     title: `min charge tracking 5 ${i}`,
                    //     details: 'min charge tracking 5'
                    // })
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_minimum_charge_count', line: i, value: 1, ignoreFieldChange: false });

                  } else {
                    // log.emergency({
                    //     title: `min charge tracking 6 ${i}`,
                    //     details: 'min charge tracking 6'
                    // })
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_minimum_charge_count', line: i, value: '', ignoreFieldChange: false });
                  }
                } else {
                  let lineStreamNumber = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i });
                  let lineWorkCentre = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i });
                  // log.emergency({
                  //     title: 'tracking 7',
                  //     details: {
                  //         lineStreamNumber,
                  //         lineWorkCentre
                  //     }
                  // })
                  if (!lineStreamNumber || !lineWorkCentre) {
                    // log.emergency({
                    //     title: `min charge tracking 7 ${i}`,
                    //     details: 'min charge tracking 7'
                    // });
                    if (findItem.minCharge) {
                      // log.emergency({
                      //     title: `min charge tracking 5 ${i}`,
                      //     details: 'min charge tracking 5'
                      // })
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_minimum_charge_count', line: i, value: 1, ignoreFieldChange: false });
                    } else {
                      // log.emergency({
                      //     title: `min charge tracking 6 ${i}`,
                      //     details: 'min charge tracking 6'
                      // })
                      newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_minimum_charge_count', line: i, value: '', ignoreFieldChange: false });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    //#endregion
  }

  function afterSubmit(context) {
    const newRecord = context.newRecord;
    const oldRecord = context.oldRecord;
    let currentUser = getUserInfo();

    //#region 📜 Run | Skip Locked Record
    if (newRecord.type == 'customrecord_ddc_run' && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
      let custrecord_ddc_run_locked = newRecord.getValue('custrecord_ddc_run_locked');
      if (custrecord_ddc_run_locked) {
        return;
      }
      let parentJob = newRecord.getValue('custrecord_ddc_run_job');
      if (parentJob) {
        let custbody_ddc_job_locked = search.lookupFields({ type: 'transaction', id: parentJob, columns: ['custbody_ddc_job_locked'] }).custbody_ddc_job_locked;
        if (custbody_ddc_job_locked) {
          return;
        }
      }
    }
    //#endregion

    // //#region 📜 Run Detail | Skip Locked Record
    // if (newRecord.type == 'customrecord_ddc_run_detail' && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
    //     let parentRun = newRecord.getValue('custrecord_ddc_rd_parent_run');
    //     if (parentRun) {
    //         let custrecord_ddc_run_locked = search.lookupFields({ type: 'customrecord_ddc_run', id: parentRun, columns: ['custrecord_ddc_run_locked'] }).custrecord_ddc_run_locked;
    //         if (custrecord_ddc_run_locked) {
    //             return;
    //         }
    //     }
    //     let parentJob = newRecord.getValue('custrecord_ddc_rd_job');
    //     if (parentJob) {
    //         let custbody_ddc_job_locked = search.lookupFields({ type: 'transaction', id: parentJob, columns: ['custbody_ddc_job_locked'] }).custbody_ddc_job_locked;
    //         if (custbody_ddc_job_locked) {
    //             return;
    //         }
    //     }
    // }
    // //#endregion

    // //#region 📜 Run | Skip if Other Run Locked
    // // Test: if other Run with the same job is locked then skip to avoid RCRD_HAS_BEEN_CHANGED Record has been changed.
    // // Result: Cannot check if other Run is locked when updating in parallel.
    // if (newRecord.type == 'customrecord_ddc_run' && [context.UserEventType.EDIT].includes(context.type)) {
    //     let custrecord_ddc_run_job = newRecord.getValue('custrecord_ddc_run_job');

    //     let lockedRunIds = [];
    //     if (custrecord_ddc_run_job) {
    //         let customrecord_ddc_runSearchObj = search.create({
    //             type: "customrecord_ddc_run",
    //             filters:
    //                 [
    //                     ["custrecord_ddc_run_job", "anyof", custrecord_ddc_run_job],
    //                     "AND",
    //                     ["internalid", "noneof", newRecord.id],
    //                     "AND",
    //                     ["custrecord_ddc_run_locked", "is", "T"]
    //                 ],
    //             columns:
    //                 [
    //                     search.createColumn({ name: "internalid", label: "Internal ID" })
    //                 ]
    //         });

    //         customrecord_ddc_runSearchObj.run().each(function (result) {
    //             lockedRunIds.push(result.getValue({ name: 'internalid' }));
    //             return true;
    //         });
    //     }

    //     if (lockedRunIds.length > 0) {
    //         log.debug('⏭️ Skip Run', 'Run ID ' + newRecord.id + ' | Other Run Locked IDs: ' + lockedRunIds.join(', '));
    //         return;
    //     } else {
    //         log.debug('▶️ Run ID ' + newRecord.id + ' | No Other Run Locked');
    //     }
    // }
    // //#endregion

    // //#region 📜 Run | Load Job
    // let jobLogObj = logStart();
    // let jobRec;
    // let jobRecEditFlag = false;
    // if (newRecord.type == 'customrecord_ddc_run' && context.type == context.UserEventType.EDIT) {
    //     let custrecord_ddc_run_job = newRecord.getValue('custrecord_ddc_run_job');
    //     if (custrecord_ddc_run_job) {
    //         jobRec = record.load({ type: record.Type.SALES_ORDER, id: custrecord_ddc_run_job });
    //     }
    // }
    // //#endregion

    // //#region 📜 Run | Rate Schedule (Edit Job)
    // // 26/07/2024 Move to DDC_Job_Process_optimised_SS.js to avoid RCRD_HAS_BEEN_CHANGED Record has been changed.
    // if (newRecord.type == 'customrecord_ddc_run' && (context.type == context.UserEventType.EDIT || (runtime.executionContext == runtime.ContextType.WEBSERVICES && currentUser.user_internalid == Enum.User.SystemAccount))) {
    //     let logObj = logStart();
    //     let runId = newRecord.id;
    //     let custrecord_ddc_run_job = newRecord.getValue('custrecord_ddc_run_job');

    //     let customrecord_ddc_runSearchObj = search.create({
    //         type: "customrecord_ddc_run",
    //         filters:
    //             [
    //                 // ["internalid", "anyof", runId],
    //                 // "AND",
    //                 ["custrecord_ddc_run_job", "anyof", custrecord_ddc_run_job],
    //                 "AND",
    //                 ["custrecord_ddc_run_job.mainline", "is", "T"]
    //             ],
    //         columns:
    //             [
    //                 search.createColumn({ name: "name", label: "Name" }),
    //                 search.createColumn({ name: "custrecord_ddc_run_job", label: "Job" }),
    //                 search.createColumn({ name: "entity", join: "CUSTRECORD_DDC_RUN_JOB", label: "Name" }),
    //                 search.createColumn({ name: "subsidiary", join: "CUSTRECORD_DDC_RUN_JOB", label: "Subsidiary" }),
    //                 search.createColumn({ name: "custrecord_ddc_rd_actual_qty_completed", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Actual Qty Completed" }),
    //                 search.createColumn({ name: "custrecord_ddc_rd_item", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Item" }),
    //                 search.createColumn({ name: "custrecord_ddc_rd_lineid", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Line ID" }),
    //                 search.createColumn({ name: "custrecord_ddc_rd_minimum_charge", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Minimum Charge" }),
    //                 search.createColumn({ name: "custrecord_ddc_actual_rate", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Actual Rate" }),

    //             ]
    //     });

    //     let searchResults = []; let count = 0; let pageSize = 1000; let start = 0;
    //     do {
    //         let subSearchResults = customrecord_ddc_runSearchObj.run().getRange({ start: start, end: start + pageSize });
    //         searchResults = searchResults.concat(subSearchResults);
    //         count = subSearchResults.length;
    //         start += pageSize;
    //     } while (count == pageSize);

    //     let subsidiaryValue = searchResults[0].getValue({ name: 'subsidiary', join: 'CUSTRECORD_DDC_RUN_JOB' });
    //     let entityValue = searchResults[0].getValue({ name: 'entity', join: 'CUSTRECORD_DDC_RUN_JOB' });
    //     let jobId = searchResults[0].getValue({ name: 'custrecord_ddc_run_job' });

    //     if (subsidiaryValue == Enum.Subsidiary.DDC) { // If the subsidiary of the job is 2, then run rate schedule process.
    //         //check for parent rate card if no crc for current customer
    //         let parentCustomer = search.lookupFields({ type: 'customer', id: entityValue, columns: 'parent' })
    //         let entityIds = []
    //         if (parentCustomer) {
    //             let parentCustomerId = parentCustomer.parent[0].value
    //             entityIds = [entityValue, parentCustomerId, Enum.Customer.DDC]
    //         } else {
    //             entityIds = [entityValue, Enum.Customer.DDC]
    //         }
    //         let parentCrcIds = getCrcId(entityIds)

    //         let runDetailArr = [];
    //         for (let i = 0; i < searchResults.length; i++) {
    //             let data = searchResults[i];
    //             let actualRunQty = parseFloat(data.getValue({ name: 'custrecord_ddc_rd_actual_qty_completed', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' }) || 0);
    //             let runName = data.getValue({ name: 'name' });
    //             let itemId = data.getValue({ name: 'custrecord_ddc_rd_item', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' });
    //             let itemName = data.getText({ name: 'custrecord_ddc_rd_item', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' });
    //             let lineId = data.getValue({ name: 'custrecord_ddc_rd_lineid', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' });
    //             let rdQty = data.getValue({ name: 'custrecord_ddc_rd_actual_qty_completed', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' });
    //             let rdRate = data.getValue({ name: 'custrecord_ddc_actual_rate', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' });
    //             let rdMinCharge = data.getValue({ name: 'custrecord_ddc_rd_minimum_charge', join: "CUSTRECORD_DDC_RD_PARENT_RUN" });
    //             let actualRate = data.getValue({ name: 'custrecord_ddc_actual_rate', join: "CUSTRECORD_DDC_RD_PARENT_RUN" });
    //             runDetailArr.push({ jobId, runId, runName, parentCrcIds, entityIds, itemId, itemName, actualRunQty, lineId, rdQty, rdMinCharge, rdRate, actualRate });
    //         }

    //         // let jobRec = record.load({ type: record.Type.SALES_ORDER, id: jobId });

    //         for (let i = 0; i < runDetailArr.length; i++) {
    //             let { jobId, runId, runName, parentCrcIds, entityIds, itemId, itemName, actualRunQty, lineId, rdQty, rdMinCharge, rdRate, actualRate } = runDetailArr[i];

    //             if (!runId) {
    //                 return;
    //             }

    //             if (actualRunQty > 0) {
    //                 jobRecEditFlag = true;

    //                 let runDetailArrFiltered = runDetailArr.filter((item) => {
    //                     return item.jobId == jobId && item.itemId == itemId && item.lineId == lineId
    //                 });
    //                 let rateScheduleArr = runDetailArrFiltered.filter(data => !data.rdMinCharge);
    //                 let minChargeArr = runDetailArrFiltered.filter(data => data.rdMinCharge);

    //                 let totalJobQty = 0;
    //                 let lineNum = jobRec.findSublistLineWithValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', value: lineId });
    //                 if (!actualRunQty) {
    //                     totalJobQty = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum });
    //                 } else {
    //                     totalJobQty = actualRunQty
    //                 }
    //                 // var totalJobQty = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum });
    //                 var runCrcDetails = getCrcItemDetails(entityValue, itemId, totalJobQty, parentCrcIds, entityIds)

    //                 //add manual rate validation
    //                 if (runCrcDetails.length > 0) {
    //                     var manualRate = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_manual_rate_change', line: lineNum });
    //                     if (!manualRate && itemId != Enum.Item.POSTAU && itemId != Enum.Item.POSTOS) {

    //                         jobRec.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: runCrcDetails[0].itemRate });
    //                         jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: lineNum, value: runCrcDetails[0].itemRate });
    //                         var testAmount = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rollup_amount', line: lineNum }) || 0;
    //                         jobRec.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: lineNum, value: testAmount });
    //                     }
    //                     var rateStore = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate_storage', line: lineNum });
    //                     jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_crc_rate', line: lineNum, value: rateStore });
    //                 }
    //                 else {
    //                     //doing some thing 
    //                 }

    //                 var finalSchedule = ''
    //                 if (rateScheduleArr.length > 0) {
    //                     var groupByRate = _.groupBy(rateScheduleArr, 'rdRate')
    //                     Object.keys(groupByRate).forEach((keys, keyIndex) => {
    //                         var totalQty = 0
    //                         var totalRuns = 0;
    //                         groupByRate[keys].forEach((value, index) => {
    //                             totalQty += parseFloat(value.rdQty)
    //                             totalRuns++
    //                         })

    //                         var rdRate = parseFloat(groupByRate[keys][0].rdRate)
    //                         var totalAmnt = totalQty * rdRate
    //                         if (totalQty > 0) {
    //                             // finalSchedule += ' Qty: ' + totalQty + ' @ ' + groupByRate[keys][0].rdRate + '\n' + ' Total: ' + totalAmnt + ' For ' + totalRuns + ' Runs.'
    //                             finalSchedule += ' Qty: ' + totalQty + ' @ ' + groupByRate[keys][0].rdRate + '\n' + ' For ' + totalRuns + ' Run/s.'
    //                         }
    //                     })
    //                 }

    //                 if (minChargeArr.length > 0) {
    //                     var groupByRate = _.groupBy(minChargeArr, 'rdRate')
    //                     var minChargeCount = 0;

    //                     Object.keys(groupByRate).forEach((keys, keyIndex) => {
    //                         var totalQty = 0
    //                         groupByRate[keys].forEach((value, index) => {
    //                             totalQty += parseFloat(value.rdQty)
    //                             minChargeCount++
    //                         })
    //                         if (totalQty > 0) {
    //                             // finalSchedule += '\n' + groupByRate[keys][0].itemName + ' Minimum charge: ' + ' Qty: ' + totalQty + ' @ ' + groupByRate[keys][0].rdRate + '\n' + '* includes ' + minChargeCount + 'x minimum charge'
    //                             finalSchedule += '\n' + ' Qty: ' + totalQty + ' @ ' + groupByRate[keys][0].rdRate + '\n' + '* includes ' + minChargeCount + 'x minimum charge'
    //                         }
    //                     })
    //                 }

    //                 // April 3, 2024
    //                 // Added a condition to check if the searchResultCount is greater than 1 then
    //                 // set the rate schedule to the sublist field

    //                 // let runDetailCount = 0;
    //                 // if (jobId && itemId && lineId) {
    //                 //     let customrecord_ddc_runSearchObj = search.create({
    //                 //         type: "customrecord_ddc_run",
    //                 //         filters:
    //                 //             [
    //                 //                 ["custrecord_ddc_run_job", "anyof", jobId],
    //                 //                 "AND",
    //                 //                 ["custrecord_ddc_rd_parent_run.custrecord_ddc_rd_item", "anyof", itemId],
    //                 //                 "AND",
    //                 //                 ["custrecord_ddc_rd_parent_run.custrecord_ddc_rd_lineid", "is", lineId]
    //                 //             ],
    //                 //         columns: []
    //                 //     });
    //                 //     runDetailCount = customrecord_ddc_runSearchObj.runPaged().count;
    //                 // }

    //                 if (runDetailArrFiltered.length > 1) {
    //                     jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate_schedule', line: lineNum, value: finalSchedule });
    //                 } else {
    //                     jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate_schedule', line: lineNum, value: '' });
    //                 }
    //                 log.debug('Rate Schedule | finalSchedule', 'Line ' + lineNum + ' | finalSchedule ' + finalSchedule + ' | runDetailArrFiltered.length ' + runDetailArrFiltered.length)
    //             }
    //         }
    //     }

    //     logEnd({ logObj: logObj, message: 'afterSubmit | Rate Schedule' });
    // }
    // //#endregion

    // //#region 📜 Run | Move From JCS ReCal Run Detail UE (Edit Job) | 🔗 https://5281669-sb2.app.netsuite.com/app/common/scripting/script.nl?id=1304
    // // 12/07/2024 After moving the script here, we discovered that it duplicates the update_actual_quantity_job_ue.js. Therefore, we have commented out this script.
    // if (newRecord.type === 'customrecord_ddc_run' && [context.UserEventType.EDIT].includes(context.type)) {

    //     // // Search Run Detail
    //     // let runDetailIds = [];
    //     // if (newRecord.id) {
    //     //     let customrecord_ddc_runSearchObj = search.create({
    //     //         type: "customrecord_ddc_run",
    //     //         filters: [["internalid", "anyof", newRecord.id]],
    //     //         columns:
    //     //             [
    //     //                 search.createColumn({ name: "internalid", label: "Internal ID" }),
    //     //                 search.createColumn({ name: "internalid", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Internal ID" })
    //     //             ]
    //     //     });

    //     //     customrecord_ddc_runSearchObj.run().each(function (result) {
    //     //         runDetailIds.push(result.getValue({ name: 'internalid', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' }));
    //     //         return true;
    //     //     });
    //     // }

    //     try {

    //         let saleOrderId = newRecord.getValue('custrecord_ddc_run_job');
    //         if (saleOrderId) {
    //             // for (let i = 0; i < runDetailIds.length; i++) {
    //             //     let runDetailId = runDetailIds[i];
    //             // let runDetailRec = record.load({ type: 'customrecord_ddc_run_detail', id: runDetailId })
    //             // // let parentRun = runDetailRec.getValue('custrecord_ddc_rd_parent_run');
    //             // let lineid = runDetailRec.getValue('custrecord_ddc_rd_lineid');
    //             // let itemID = runDetailRec.getValue('custrecord_ddc_rd_item');

    //             let runArr = getRunByJob(saleOrderId);
    //             let runDetailArr = getRunDetail(runArr);

    //             let lineCount = jobRec.getLineCount({ sublistId: 'item' });
    //             for (let i = 0; i < lineCount; i++) {
    //                 let lineid = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', line: i });
    //                 let itemID = jobRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });

    //                 let actualQuantity = [];
    //                 let actualLabourHourSum = 0;
    //                 let actualMachineHoursSum = 0;

    //                 actualQuantity = runDetailArr.filter(x => x.itemID == itemID && x.lineId == lineid);
    //                 actualLabourHourSum = actualQuantity.reduce((n, { actualLabourHours }) => n + actualLabourHours, 0)
    //                 actualMachineHoursSum = actualQuantity.reduce((n, { actualMachineHours }) => n + actualMachineHours, 0)

    //                 if (actualQuantity.length > 0) {
    //                     jobRecEditFlag = true;

    //                     // let jobRec = record.load({ type: record.Type.SALES_ORDER, id: saleOrderId })
    //                     let lineNumber = jobRec.findSublistLineWithValue({ sublistId: 'item', fieldId: 'line', value: lineid });
    //                     //log.debug("actualWeightedStockQuantitySum", actualWeightedStockQuantitySum);
    //                     // jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_kgs', value: actualWeightedStockQuantitySum, line: lineNumber });
    //                     jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_labour_hr_total', value: actualLabourHourSum, line: lineNumber });
    //                     jobRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', value: actualMachineHoursSum, line: lineNumber });
    //                     // let salesOrderId = jobRec.save();
    //                     // log.audit('💾 Sales Order', salesOrderId);
    //                 }
    //             }
    //         }
    //         // }
    //     } catch (e) {
    //         log.error('Error',
    //             {
    //                 message: e.message,
    //                 name: e.name,
    //                 stack: e.stack,
    //             }
    //         );
    //     }
    // }
    // //#endregion

    // //#region 📜 Run | Save Job
    // if (jobRecEditFlag) {
    //     let jobRecId = jobRec.save();
    //     log.audit('💾 Sales Order', 'ID ' + jobRecId + ' | Rate Schedule / Recal Run Detail');
    // }
    // logEnd({ logObj: jobLogObj, message: 'afterSubmit | Update Job' });
    // //#endregion

    //#region 📜 Run | Move JCS Update Stage Run Detail UE | 🔗 https://5281669-sb2.app.netsuite.com/app/common/scripting/script.nl?id=1573
    if (newRecord.type === 'customrecord_ddc_run' && [context.UserEventType.EDIT].includes(context.type)) {

      // Search Run Detail
      let runDetailIds = [];
      if (newRecord.id) {
        let customrecord_ddc_runSearchObj = search.create({
          type: "customrecord_ddc_run",
          filters: [
            ["internalid", "anyof", newRecord.id],
            "AND",
            ["custrecord_ddc_rd_parent_run.custrecord_ddc_rd_stage_update", "is", "T"]
          ],
          columns:
            [
              search.createColumn({ name: "internalid", label: "Internal ID" }),
              search.createColumn({ name: "internalid", join: "CUSTRECORD_DDC_RD_PARENT_RUN", label: "Internal ID" })
            ]
        });

        customrecord_ddc_runSearchObj.run().each(function (result) {
          runDetailIds.push(result.getValue({ name: 'internalid', join: 'CUSTRECORD_DDC_RD_PARENT_RUN' }));
          return true;
        });
      }

      try {
        for (let i = 0; i < runDetailIds.length; i++) {
          let runDetailId = runDetailIds[i];
          let runDetailRec = record.load({ type: "customrecord_ddc_run_detail", id: runDetailId, });
          let parentRun = runDetailRec.getValue({ fieldId: 'custrecord_ddc_rd_parent_run' });
          if (!parentRun) {
            return;
          }
          let streamNumberRec = runDetailRec.getValue({ fieldId: 'custrecord_ddc_rd_stream_number' });
          let statusRunNew = runDetailRec.getValue({ fieldId: 'custrecord_ddc_rd_status' });
          let statusRunOld = oldRecord.getValue({ fieldId: 'custrecord_ddc_rd_status' });
          if (statusRunNew == statusRunOld) {
            log.debug("nothing todo", 'nothing todo')
            return;
          }

          //Completed 5
          //Cancelled 8
          let runDetailArr = getRunDetail(parentRun);
          runDetailArr = runDetailArr.filter(x => x.streamNumber == streamNumberRec)
          let runDetailArr1 = runDetailArr.filter(x => x.statusRunDetail !== "Completed" && x.statusRunDetail !== "Cancelled")
          let runDetailArr2 = runDetailArr.filter(x => x.statusRunDetail == "Completed" || x.statusRunDetail == "Cancelled")
          runDetailArr2 = runDetailArr2.filter(x => x.internalId != runDetailId);
          runDetailArr1 = runDetailArr1.sort((a, b) => {
            return a.scheduleSequence - b.scheduleSequence;
          });

          if (runDetailArr1.length > 0) {
            let itemCategory = runDetailArr1[0].itemCategory;
            let statusRunDetail = runDetailArr1[0].statusRunDetail;
            record.submitFields({
              type: 'customrecord_ddc_run_detail',
              id: runDetailId,
              values: {
                'custrecord_ddc_rd_stage': itemCategory,
                "custrecord_ddc_rd_next_pending_rd_status": statusRunDetail
              }
            });

            for (let i = 0; i < runDetailArr1.length; i++) {
              record.submitFields({
                type: 'customrecord_ddc_run_detail',
                id: runDetailArr1[i].internalId,
                values: {
                  'custrecord_ddc_rd_stage': itemCategory,
                  "custrecord_ddc_rd_next_pending_rd_status": statusRunDetail
                }

              })
            };

            for (let j = 0; j < runDetailArr2.length; j++) {
              record.submitFields({
                type: 'customrecord_ddc_run_detail',
                id: runDetailArr2[j].internalId,
                values: {
                  'custrecord_ddc_rd_stage': itemCategory,
                  "custrecord_ddc_rd_next_pending_rd_status": statusRunDetail
                }

              })
            }
          }

          else {
            for (let j = 0; j < runDetailArr.length; j++) {
              record.submitFields({
                type: 'customrecord_ddc_run_detail',
                id: runDetailArr[j].internalId,
                values: {
                  'custrecord_ddc_rd_stage': "",
                  "custrecord_ddc_rd_next_pending_rd_status": ""
                }

              })
            }
          }

          record.submitFields({ type: 'customrecord_ddc_run_detail', id: runDetailId, values: { 'custrecord_ddc_rd_stage_update': false } });
        }
      } catch (error) {
        log.error("error", error)
      }

      function getRunDetail(runParent) {
        var ret = [];
        var runDetailSearch = search.create({
          type: "customrecord_ddc_run_detail",
          filters:
            [
              ["custrecord_ddc_rd_parent_run", "anyof", runParent]
            ],
          columns:
            [
              search.createColumn({ name: "internalid", label: "Internal ID" }),
              search.createColumn({ name: "custrecord_ddc_rd_sched_seq", label: "Schedule Sequence" }),
              search.createColumn({ name: "custrecord_ddc_rd_stream_number", label: "Stream Number" }),
              search.createColumn({ name: "custrecord_ddc_rd_item_category", label: "Item Category" }),
              search.createColumn({ name: "custrecord_ddc_rd_status", label: "Run Detail Status" })
            ]
        });
        var searchResultCount = runDetailSearch.runPaged().count;
        log.debug("customrecord_ddc_run_detailSearchObj result count", searchResultCount);
        if (runDetailSearch) {
          var ssResult = getAllResults(runDetailSearch);
          for (var i = 0; i < ssResult.length; i++) {
            var internalId = ssResult[i].id;
            var scheduleSequence = parseInt(ssResult[i].getValue('custrecord_ddc_rd_sched_seq'));
            var streamNumber = parseInt(ssResult[i].getValue('custrecord_ddc_rd_stream_number'));
            var itemCategory = parseInt(ssResult[i].getValue('custrecord_ddc_rd_item_category'));
            var statusRunDetail = (ssResult[i].getText('custrecord_ddc_rd_status'));
            ret.push({
              internalId: internalId,
              scheduleSequence: scheduleSequence,
              streamNumber: streamNumber,
              itemCategory: itemCategory,
              statusRunDetail: statusRunDetail

            });
          }
        }
        else {
          log.debug(waJcurce, ' Return Null, Search issue');
          return [];
        }
        return ret;
      }

      function getAllResults(search) {
        var results = [];
        var pgSize = 1000;
        var r = search.runPaged({ pageSize: pgSize });
        var numPage = r.pageRanges.length;
        var searchPage;
        var ssResult;
        for (var np = 0; np < numPage; np++) {
          searchPage = r.fetch({ index: np });
          ssResult = searchPage.data;
          if (ssResult != undefined && ssResult != null && ssResult != '') {
            results = results.concat(ssResult);
          }
        }
        return results;

      }
    }
    //#endregion
  }

  //#region 📜 Run | Rate Schedule Function
  function getCrcId(custId) {
    var parentCrcId = {};

    // log.debug({
    //     title: 'custId',
    //     details: 'custId: ' + custId
    // })

    var customrecord_customer_rate_cardSearchObj = search.create({
      type: "customrecord_customer_rate_card",
      filters:
        [
          ["custrecord_crc_customer", "anyof", custId], "AND",
          ["isinactive", "is", "F"]
        ],
      columns:
        [
          search.createColumn({ name: "internalid", label: "Internal ID" }),
          search.createColumn({ name: "custrecord_crc_doc_number", label: "Document Number" }),
          search.createColumn({ name: "custrecord_crc_customer", label: "Customer" }),
          search.createColumn({ name: "custrecord_crc_start_date", label: "Contract Start Date" }),
          search.createColumn({ name: "custrecord_crc_end_date", label: "Contract End Date" })
        ]
    });

    customrecord_customer_rate_cardSearchObj.run().each(function (result) {
      let customerId = result.getValue('custrecord_crc_customer')
      parentCrcId[customerId] = parseFloatOrZero(result.getValue('internalid'))
      // .run().each has a limit of 4,000 results
      return true;
    });

    // log.debug({
    //     title: 'parentCrcId',
    //     details: 'parentCrcId: ' + JSON.stringify(parentCrcId)
    // })

    return parentCrcId
  }

  const loadCrcItemDetail = (itemId, newBillableQty, parentCrcIds, entityIds) => {

  }


  function getCrcItemDetails(customerId, itemId, newBillableQty, parentCrcIds, entityIds) {
    var itemDetailsArr = []
    var dataMappingParentObject = getDataMappingParent(parentCrcIds, itemId, newBillableQty);

    //testing array find
    for (var p = 0; p < entityIds.length; p++) {
      if (itemDetailsArr.length == 0) {
        // log.debug("entityIds[p] finding", entityIds[p]);
        var matchCustomer = parentCrcIds[entityIds[p]]
        // log.debug("matchCustomer", matchCustomer);
        var foundCrcCustomer = dataMappingParentObject.find(parent => parent.parent == matchCustomer)
        if (foundCrcCustomer) {
          // log.debug("foundCrcCustomer", foundCrcCustomer);
          itemDetailsArr.push({
            parent: foundCrcCustomer.parent,
            itemUnit: foundCrcCustomer.itemUnit,
            itemMeasure: foundCrcCustomer.itemMeasure,
            itemRate: foundCrcCustomer.itemRate,
            minCharge: foundCrcCustomer.minCharge,
            flatFee: foundCrcCustomer.flatFee,
            fromQty: foundCrcCustomer.fromQty,
            toQty: foundCrcCustomer.toQty,
            isMinCharge: foundCrcCustomer.isMinCharge,
          })
          break;
        }
      }
    }

    return itemDetailsArr;
  }


  /**
   * August 28, 2023 - v1.1.0
   * Test Function for Loading the CRC Item Details
   * This replicates the getDataMappingParent but loads the whole Data set
   * This is to set the CRC Item Details to the CRC Item Details Array by not using the search on the loop.
   * @param {*} parentCrcIds 
   * @param {*} itemId 
   * @param {*} newBillableQty 
   * @returns array
   */
  const loadItemCRCData = ({ parentCrcIds, customerId }) => {
    var fifter = [];
    for (var item in parentCrcIds) {
      fifter.push(parentCrcIds[item])
    }
    // log.emergency({
    //     title: 'fifter',
    //     details: fifter
    // })
    var crcItemDetailsObj = search.create({
      type: "customrecord_crc_items",
      filters:
        [
          ["custrecord_crc_parent", "anyof", fifter]
        ],
      columns:
        [
          search.createColumn({ name: "custrecord_crc_parent", label: "Parent CRC" }),
          // search.createColumn({ name: "custrecord_crc_hidden_item_no", label: "Group Item No." }),
          // search.createColumn({ name: "custrecord_crc_item_no", label: "Item No." }),
          search.createColumn({ name: "custrecord_crc_item", label: "Item" }),
          search.createColumn({ name: "custrecord_crc_cust_itemcode", label: "Customer Item Name" }),
          search.createColumn({ name: "custrecord_crc_unit", label: "Unit" }),
          search.createColumn({ name: "custrecord_crc_measure", label: "Measure" }),
          // search.createColumn({ name: "custrecord_crc_from_quantity", sort: search.Sort.ASC, label: "From Quantity" }),
          // search.createColumn({ name: "custrecord_crc_to_quantity", label: "To Quantity" }),
          search.createColumn({
            name: "formulanumeric_sort",
            formula: "CASE WHEN {custrecord_crc_parent.custrecord_crc_customer.id} = " + customerId + " THEN 1 WHEN {custrecord_crc_parent.custrecord_crc_customer.id} = 1379120 THEN 3 ELSE 2 END",
            sort: search.Sort.ASC,
            label: "Sort"
          }), // Customer = 1, Parent = 2, Generic DDC Customer = 3
          search.createColumn({ name: "formulanumeric_from_quantity", formula: "TO_NUMBER({custrecord_crc_from_quantity})", sort: search.Sort.ASC, label: "From Quantity" }), // Convert Free-Form Text to Number
          search.createColumn({ name: "formulanumeric_to_quantity", formula: "TO_NUMBER(NVL({custrecord_crc_to_quantity}, 99999999999999))", label: "To Quantity" }), // Convert Free-Form Text to Number
          search.createColumn({ name: "custrecord_crc_rate", label: "Rate" }),
          search.createColumn({ name: "custrecord_crc_minimum_charge", label: "Minimum Charge" }),
          search.createColumn({ name: "custrecord_crc_flat_fee", label: "Flat Fee" }),

        ]
    });
    resultCount = crcItemDetailsObj.runPaged().count;
    let results = getResults(crcItemDetailsObj.run());
    results = results.map(mapCRCItem)
    return results
  }

  const mapCRCItem = (result) => {
    return {
      parent: parseInt(result.getValue('custrecord_crc_parent')),
      fromQty: parseFloatOrZero(result.getValue('formulanumeric_from_quantity')),
      toQty: parseFloat(result.getValue('formulanumeric_to_quantity')),
      itemUnit: result.getValue('custrecord_crc_unit'),
      itemMeasure: result.getValue('custrecord_crc_measure'),
      itemRate: result.getValue('custrecord_crc_rate'),
      minCharge: result.getValue('custrecord_crc_minimum_charge'),
      flatFee: result.getValue('custrecord_crc_flat_fee'),
      item: result.getValue('custrecord_crc_item')
    };
  };

  const checkBillableQty = (data, newBillableQty) => {
    arrayHolder = [];
    data.forEach((result) => {
      var parent = parseInt(result.parent)
      var fromQty = parseInt(result.fromQty)
      var toQty = parseInt(result.toQty)
      var itemUnit = result.itemUnit
      var itemMeasure = result.itemMeasure
      var itemRate = result.itemRate
      var minCharge = result.minCharge
      var flatFee = result.flatFee
      var item = result.item
      if (newBillableQty >= fromQty && newBillableQty <= toQty) {
        arrayHolder.push({
          parent: parent,
          fromQty: fromQty,
          toQty: toQty,
          itemUnit: itemUnit,
          itemMeasure: itemMeasure,
          itemRate: itemRate,
          minCharge: minCharge,
          flatFee: flatFee,
          item: item
        })
        log.debug({
          title: 'BETWEEN FROM AND TO QTY',
          details: 'BETWEEN FROM AND TO QTY. ITEM ADDED'
        })
      } else if (isNaN(fromQty) && isNaN(toQty)) {
        arrayHolder.push({
          parent: parent,
          fromQty: fromQty,
          toQty: toQty,
          itemUnit: itemUnit,
          itemMeasure: itemMeasure,
          itemRate: itemRate,
          minCharge: minCharge,
          flatFee: flatFee,
          item: item

        })
        log.debug({
          title: 'NO FROM AND TO QTY',
          details: 'NO FROM AND TO QTY. ITEM ADDED'
        })
      } else if (newBillableQty >= fromQty && isNaN(toQty)) {
        arrayHolder.push({
          parent: parent,
          fromQty: fromQty,
          toQty: toQty,
          itemUnit: itemUnit,
          itemMeasure: itemMeasure,
          itemRate: itemRate,
          minCharge: minCharge,
          flatFee: flatFee,
          item: item
        })
        log.debug({
          title: 'GREATER THAN FROM QTY BUT NO TO QTY',
          details: 'GREATER THAN FROM QTY BUT NO TO QTY. ITEM ADDED'
        })
      } else if (isNaN(fromQty) && newBillableQty <= toQty) { // Added this condition to check if the fromQty is NaN and the newBillableQty is less than or equal to toQty
        ret.push({
          parent: parent,
          fromQty: fromQty,
          toQty: toQty,
          itemUnit: itemUnit,
          itemMeasure: itemMeasure,
          itemRate: itemRate,
          minCharge: minCharge,
          flatFee: flatFee
        })
      }
      return true;
    });
    return arrayHolder;
  }

  function getDataMappingParent(parentCrcIds, itemId, newBillableQty) {

    // log.emergency({
    //     title: 'getDataMappingParent parameters',
    //     details: {
    //         parentCrcIds,
    //         itemId,
    //         newBillableQty
    //     }
    // })
    var fifter = [];
    for (var item in parentCrcIds) {
      fifter.push(parentCrcIds[item])
    }
    // log.emergency({
    //     title: 'fifter',
    //     details: fifter
    // })
    var ret = [];
    var crcItemDetailsObj = search.create({
      type: "customrecord_crc_items",
      filters:
        [
          ["custrecord_crc_parent", "anyof", fifter],
          "AND",
          ["custrecord_crc_item", "anyof", itemId]
        ],
      columns:
        [
          search.createColumn({ name: "custrecord_crc_parent", label: "Parent CRC" }),
          // search.createColumn({ name: "custrecord_crc_hidden_item_no", label: "Group Item No." }),
          // search.createColumn({ name: "custrecord_crc_item_no", label: "Item No." }),
          search.createColumn({ name: "custrecord_crc_item", label: "Item" }),
          search.createColumn({ name: "custrecord_crc_cust_itemcode", label: "Customer Item Name" }),
          search.createColumn({ name: "custrecord_crc_unit", label: "Unit" }),
          search.createColumn({ name: "custrecord_crc_measure", label: "Measure" }),
          // search.createColumn({ name: "custrecord_crc_from_quantity", sort: search.Sort.ASC, label: "From Quantity" }),
          // search.createColumn({ name: "custrecord_crc_to_quantity", label: "To Quantity" }),
          search.createColumn({ name: "formulanumeric_from_quantity", formula: "TO_NUMBER({custrecord_crc_from_quantity})", sort: search.Sort.ASC, label: "From Quantity" }), // Convert Free-Form Text to Number
          search.createColumn({ name: "formulanumeric_to_quantity", formula: "TO_NUMBER(NVL({custrecord_crc_to_quantity}, 99999999999999))", label: "To Quantity" }), // Convert Free-Form Text to Number
          search.createColumn({ name: "custrecord_crc_rate", label: "Rate" }),
          search.createColumn({ name: "custrecord_crc_minimum_charge", label: "Minimum Charge" }),
          search.createColumn({ name: "custrecord_crc_flat_fee", label: "Flat Fee" }),

        ]
    });
    resultCount = crcItemDetailsObj.runPaged().count;
    // log.emergency("crcItemDetailsObj result count", resultCount);

    //if customer rate card search has results, check which from and to quantity does the item fall under

    if (resultCount > 0) {
      //var unitConverted = 0;

      crcItemDetailsObj.run().each(function (result) {
        var parent = parseInt(result.getValue('custrecord_crc_parent'))
        var fromQty = parseFloat(result.getValue('formulanumeric_from_quantity'))
        var toQty = parseFloat(result.getValue('formulanumeric_to_quantity'))
        var itemUnit = result.getValue('custrecord_crc_unit')
        var itemMeasure = result.getValue('custrecord_crc_measure')
        var itemRate = result.getValue('custrecord_crc_rate')
        var minCharge = result.getValue('custrecord_crc_minimum_charge')
        var flatFee = result.getValue('custrecord_crc_flat_fee')

        // log.emergency({
        //     title: 'result data',
        //     details: {
        //         parent,
        //         fromQty,
        //         toQty,
        //         itemUnit,
        //         itemMeasure,
        //         itemRate,
        //         minCharge,
        //         flatFee
        //     }
        // })
        //     ret.push({
        //         parent: parent,
        //         fromQty: fromQty,
        //         toQty: toQty,
        //         itemUnit: itemUnit,
        //         itemMeasure: itemMeasure,
        //         itemRate: itemRate,
        //         minCharge: minCharge,
        //         flatFee: flatFee

        //     })

        if (newBillableQty >= fromQty && newBillableQty <= toQty) {

          ret.push({
            parent: parent,
            fromQty: fromQty,
            toQty: toQty,
            itemUnit: itemUnit,
            itemMeasure: itemMeasure,
            itemRate: itemRate,
            minCharge: minCharge,
            flatFee: flatFee

          })

          log.debug({
            title: 'BETWEEN FROM AND TO QTY',
            details: 'BETWEEN FROM AND TO QTY. ITEM ADDED'
          })

        } else if (isNaN(fromQty) && isNaN(toQty)) {

          ret.push({
            parent: parent,
            fromQty: fromQty,
            toQty: toQty,
            itemUnit: itemUnit,
            itemMeasure: itemMeasure,
            itemRate: itemRate,
            minCharge: minCharge,
            flatFee: flatFee

          })

          log.debug({
            title: 'NO FROM AND TO QTY',
            details: 'NO FROM AND TO QTY. ITEM ADDED'
          })

        } else if (newBillableQty >= fromQty && isNaN(toQty)) {

          ret.push({
            parent: parent,
            fromQty: fromQty,
            toQty: toQty,
            itemUnit: itemUnit,
            itemMeasure: itemMeasure,
            itemRate: itemRate,
            minCharge: minCharge,
            flatFee: flatFee

          })

          log.debug({
            title: 'GREATER THAN FROM QTY BUT NO TO QTY',
            details: 'GREATER THAN FROM QTY BUT NO TO QTY. ITEM ADDED'
          })

        } else if (!fromQty && newBillableQty <= toQty) { // Added this condition to check if the fromQty is NaN and the newBillableQty is less than or equal to toQty
          ret.push({
            parent: parent,
            fromQty: fromQty,
            toQty: toQty,
            itemUnit: itemUnit,
            itemMeasure: itemMeasure,
            itemRate: itemRate,
            minCharge: minCharge,
            flatFee: flatFee
          })

        }

        return true;
      });

      // log.debug("ret value", JSON.stringify(ret))
      // var groupByParent = groupBy(ret, function (item) {
      //     return [item.parent];
      // });
      // log.debug("groupByParent", groupByParent)
      return ret

    }
    else {
      return []
    }
  }
  function groupBy(array, f) {
    var groups = {};
    array.forEach(function (o) {
      var group = JSON.stringify(f(o));
      groups[group] = groups[group] || [];
      groups[group].push(o);
    });
    return Object.keys(groups).map(function (group) {
      return groups[group];
    })
  }

  const parseFloatOrZero = n => parseFloat(n) || 0

  const inRange = (x, min, max) => {
    return ((x - min) * (x - max) <= 0);
  }

  // function to create a text file
  const createTextFile = (filename, content) => {
    let fileObj = file.create({
      name: filename,
      fileType: file.Type.PLAINTEXT,
      contents: content,
      folder: 447684 // logs folder
    });
    return fileObj.save();
  }

  /** 
  * @name searchPostageItems
  * @description load the saved search of DDC - Postage Management Fee Item Search
  * Search name: DDC - Postage Management Fee Item Search
  * @param {customer} integer
  *
  * @returns {results} array
  */
  var searchPostageItems = () => {
    let query = search.load({
      id: 'customsearch_ddc_pmgt_item'
    });
    let results = getResults(query.run())
    results = results.map(mapPostageItems)
    return results;
  }

  var mapPostageItems = (data) => {
    return data.id
  };

  /**
   * DONOT ALTER THIS FUNCTION
   * Retrieves all(even if data is more than 2000) 
   * search results of an nlobjSearchResultSet
   *
   * @param  {resultSet} set search result set to retrieve results
   * @return {Array}     array containing search results
   */
  var getResults = (set) => {
    let holder = [];
    let i = 0;
    while (true) {
      let result = set.getRange({
        start: i,
        end: i + 1000
      });
      if (!result) break;
      holder = holder.concat(result);
      if (result.length < 1000) break;
      i += 1000;
    }
    return holder;
  };

  const getUserInfo = () => {
    let getUser = runtime.getCurrentUser();
    let userData = {
      user_subsidiary: getUser.subsidiary,
      user_internalid: getUser.id
    }
    return userData
  }

  function getItemIds(newRecord) {
    let lineCount = newRecord.getLineCount({ sublistId: 'item' });
    let itemIds = [];
    for (let i = 0; i < lineCount; i++) {
      let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
      itemIds.push(itemId);
    }
    return [...new Set(itemIds)];
  }

  function lookupItems({ newRecord, columns }) {
    let itemResults = [];
    let itemIds = getItemIds(newRecord);
    if (itemIds.length > 0) {
      let searchColumns = [search.createColumn({ name: "internalid", label: "Internal ID" })]
      for (let i = 0; i < columns.length; i++) {
        searchColumns.push(search.createColumn({ name: columns[i] }));
      }

      let itemSearchObj = search.create({
        type: "item",
        filters: [["internalid", "anyof", itemIds]],
        columns: searchColumns
      });

      itemSearchObj.run().each(function (result) {
        let item = { id: result.id };
        columns.forEach(column => {
          item[column] = result.getValue({ name: column });
        });
        itemResults.push(item);
        return true;
      });
    }
    return itemResults;
  }
  //#endregion

  //#region 📜 Run | ReCal Run Detail Function
  // const parseFloatOrZero = n => parseFloat(n) || 0
  function getRunByJob(saleOrderId) {
    var runArr = [];
    var searchRun = search.create({
      type: "customrecord_ddc_run",
      filters:
        [
          ["custrecord_ddc_run_job", "anyof", saleOrderId]
        ],
      columns:
        [
          search.createColumn({ name: "internalid", label: "Internal ID" })
        ]
    });
    // var searchRunCount = searchRun.runPaged().count;
    // log.debug("searchRunCount", searchRunCount);
    if (searchRun) {
      var ssResult = getAllResults(searchRun);
      for (var i = 0; i < ssResult.length; i++) {
        var internalid = ssResult[i].id;
        runArr.push(internalid);
      }
    }
    else {
      // log.debug(waJcurce, ' Return Null, Search issue');
      return [];
    }
    return runArr;
  }
  function getRunDetail(runArr) {
    var ret = [];
    var runDetailSearch = search.create({
      type: "customrecord_ddc_run_detail",
      filters:
        [
          ["custrecord_ddc_rd_parent_run", "anyof", runArr]
        ],
      columns:
        [
          search.createColumn({ name: "custrecord_ddc_rd_item", label: "Item" }),
          search.createColumn({ name: "custrecord_ddc_rd_actual_qty_completed", label: "Actual Qty Completed" }),
          search.createColumn({ name: "custrecord_ddc_rd_status", label: "Run Detail Status" }),
          search.createColumn({ name: "custrecord_ddc_rd_lineid", label: "Line ID" }),
          search.createColumn({ name: "custrecord_ddc_rd_actual_machine_hr", label: "Actual Machine Hours" }),
          search.createColumn({ name: "custrecord_ddc_rd_actual_labour_hr", label: "Actual Labour Hours" }),
          search.createColumn({ name: "custrecord_ddc_rd_actual_calc_cost", label: "Actual Calculated Cost" }),
          //search.createColumn({ name: "custrecord_ddc_rd_actual_w_stock_qty", label: "Actual Weighted Stock Quantity" })
        ]
    });
    // var searchResultCount = runDetailSearch.runPaged().count;
    // log.debug("customrecord_ddc_run_detailSearchObj result count", searchResultCount);
    if (runDetailSearch) {
      var ssResult = getAllResults(runDetailSearch);
      for (var i = 0; i < ssResult.length; i++) {
        var internalId = ssResult[i].id;
        var itemID = parseInt(ssResult[i].getValue('custrecord_ddc_rd_item'));
        var actualQuantity = Number(ssResult[i].getValue('custrecord_ddc_rd_actual_qty_completed')) || 0;
        var status = ssResult[i].getValue('custrecord_ddc_rd_status');
        var lineId = parseInt(ssResult[i].getValue('custrecord_ddc_rd_lineid'));
        var actualMachineHours = Number(ssResult[i].getValue('custrecord_ddc_rd_actual_machine_hr')) || 0;
        var actualLabourHours = Number(ssResult[i].getValue('custrecord_ddc_rd_actual_labour_hr')) || 0;
        var actualCalculatedCost = Number(ssResult[i].getValue('custrecord_ddc_rd_actual_calc_cost')) || 0;
        //var actualWeightedStockQuantity = Number(ssResult[i].getValue('custrecord_ddc_rd_actual_w_stock_qty')) || 0;
        ret.push({
          internalId: internalId,
          itemID: itemID,
          actualQuantity: actualQuantity,
          status: status,
          lineId: lineId,
          actualMachineHours: actualMachineHours,
          actualLabourHours: actualLabourHours,
          actualCalculatedCost: actualCalculatedCost,
          // actualWeightedStockQuantity: actualWeightedStockQuantity

        });
      }
    }
    else {
      log.debug(waJcurce, ' Return Null, Search issue');
      return [];
    }
    return ret;
  }
  function getAllResults(search) {
    var results = [];
    var pgSize = 1000;
    var r = search.runPaged({ pageSize: pgSize });
    var numPage = r.pageRanges.length;
    var searchPage;
    var ssResult;
    for (var np = 0; np < numPage; np++) {
      searchPage = r.fetch({ index: np });
      ssResult = searchPage.data;
      if (ssResult != undefined && ssResult != null && ssResult != '') {
        results = results.concat(ssResult);
      }
    }
    return results;

  }
  //#endregion

  function logStart() {
    let reportStart = new Date();
    let scriptObj = runtime.getCurrentScript();
    let reportUsageLimit = scriptObj.getRemainingUsage();
    return { reportStart, reportUsageLimit };
  }

  function logEnd({ logObj, message }) {
    let reportStart = logObj.reportStart;
    let reportUsageLimit = logObj.reportUsageLimit;
    let scriptObj = runtime.getCurrentScript();

    let reportEnd = new Date();
    let reportExecuteTime = `${Math.floor((reportEnd - reportStart) / 60000)} Minutes ${Math.floor((reportEnd - reportStart) / 1000) % 60} Seconds`;
    log.audit('Execution Log', message + ' | ' + runtime.executionContext + ' | Execution Time ' + reportExecuteTime + ' | Used Governance ' + (reportUsageLimit - scriptObj.getRemainingUsage()) + '/' + reportUsageLimit + ' Units');
  }

  return {
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
  }
});