/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/*
 * @name:                                       workcentre_map_ue.js
 * @author:                                     LC
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Tue Oct 11 2022 3:25:28 PM
 *
 * Change Logs:
 *
 * Tue Oct 11 2022 3:25:28 PM       LC      Initial Creation
 * Tue Aug 22 2023 9:33:00 AM       Junnel  Added preferred and alternate fulfillment bin to sourcing. - v1.2.0
 */

/**
 * @deployedto Job
 * @deployedto Quote
 */

define(['N/record', 'N/runtime', 'N/search'],
  /**
* @param{record} record
* @param{runtime} runtime
* @param{search} search
*/
  (record, runtime, search) => {
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

      let testingSalesOrder = 1580159
      try {
        //as per FC, only set work center to default during save by SCPQ (context: SUITELET)
        // if (runtime.executionContext == 'SUITELET' || newRecord.id == 1580159 || newRecord.id == 1580182 || newRecord.id == 1580334) {
        // if(scriptContext.type.match(/create/g) || runtime.executionContext == 'SUITELET'){
        // if (scriptContext.type.match(/create|copy|edit|approve/g)) {
        var subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
        log.debug("subsidiary", subsidiary);
        if (subsidiary != '2') {
          return;
        }
        let lineItems = []
        /**
         * Aug 24, 2023 - DDC CO019
         * This part was added to insert the work centre to the inventory items
         * 
         */
        let workCentreArrayForInventoryItems = [];
        let lineCount = newRecord.getLineCount({ sublistId: 'item' })
        // Consider only line items with out work centre value
        for (let i = 0; i < lineCount; i++) {
          let workCentreId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i })
          let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
          log.debug("lineItems push", 'itemid: ' + itemId + ' workCenter: ' + workCentreId);
          let site = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', line: i });
          let workCentreGroup = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre_group', line: i });
          log.debug("site&&workCentreGroup", 'site: ' + site + ' || workCentreGroup: ' + workCentreGroup);
          if (site && workCentreId) {
            lineItems.push({
              itemId: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }),
              site: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', line: i }),
              itemCategory: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_category', line: i }),
              workCentreGroup: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre_group', line: i }),
              workCentreId,
              labourRate: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hour_rate', line: i }),
              labourOHRate: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_rate', line: i }),
              machineRate: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hour_rate', line: i }),
              line: i,
              itemTypeDisplay: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_type_display', line: i }), // Aug 24, 2023 - DDC CO019
              itemType: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i }), // Aug 24, 2023 - DDC CO019
              taskGroupCode: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_task_group_code', line: i }), // Aug 24, 2023 - DDC CO019
            })
          }

          // Aug 24, 2023 - DDC CO019
          workCentreArrayForInventoryItems.push({
            itemId: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }),
            site: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', line: i }),
            itemCategory: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_category', line: i }),
            workCentreGroup: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre_group', line: i }),
            workCentreId,
            labourRate: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hour_rate', line: i }),
            labourOHRate: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_rate', line: i }),
            machineRate: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hour_rate', line: i }),
            line: i,
            itemTypeDisplay: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_type_display', line: i }), // Aug 24, 2023 - DDC CO019
            itemType: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i }), // Aug 24, 2023 - DDC CO019
            taskGroupCode: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_task_group_code', line: i }), // Aug 24, 2023 - DDC CO019
            lineUniqueKey: newRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i }) // Aug 24, 2023 - DDC CO019 
          });
        }
        log.debug("before remove lineItems", lineItems);
        log.debug({
          title: 'workCentreArrayForInventoryItems',
          details: workCentreArrayForInventoryItems
        })

        // Aug 24, 2023 - DDC CO019
        var inventoryItemArray = workCentreArrayForInventoryItems.filter((val) => { return val.itemTypeDisplay == 'Inventory Item' });
        var arrayHolder = [] // Holds the inventory items
        inventoryItemArray.forEach((value) => {
          lineItems.find((val) => {
            if (value.taskGroupCode == val.taskGroupCode) {
              arrayHolder.push({
                itemId: value.itemId,
                site: value.site,
                itemCategory: value.itemCategory,
                workCentreGroup: val.workCentreGroup, // Set Work Centre Group from related item
                workCentreId: val.workCentreId, // set Work Centre ID from related item
                labourRate: value.labourRate,
                labourOHRate: value.labourOHRate,
                machineRate: value.machineRate,
                line: value.line,
                itemTypeDisplay: value.itemTypeDisplay,
                itemType: value.itemType,
                taskGroupCode: value.taskGroupCode,
                lineUniqueKey: value.lineUniqueKey
              })
            }
          })
        });
        log.emergency({
          title: 'arrayHolder',
          details: arrayHolder
        })

        // set the line items work centre first
        if (arrayHolder.length > 0) {
          arrayHolder.forEach((value) => {
            let lineId = newRecord.findSublistLineWithValue({ sublistId: 'item', fieldId: 'lineuniquekey', value: value.lineUniqueKey });
            log.emergency({
              title: 'lineId',
              details: lineId
            })

            newRecord.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_work_centre',
              line: lineId,
              value: value.workCentreId
            });
            newRecord.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_work_centre_group',
              line: lineId,
              value: value.workCentreGroup
            });

          })
        }

        // Merge arrays of lineItems and arrayHolder
        lineItems = [...lineItems, ...arrayHolder];

        // Remove items with no site and item category
        lineItems = lineItems.filter(f => f.site && f.workCentreGroup)
        log.debug('lineItems filters', lineItems)
        if (lineItems.length > 0) {
          log.debug("dkm vao day khong", "dkm vao day khong")
          // Search for Work center list customrecord
          let xFilters = []
          for (lineItem of lineItems) {
            xFilters.push(
              [
                ['custrecord_ddc_wcl_site', 'is', lineItem.site],
                'AND',
                ['custrecord_ddc_wcl_work_centre_group', 'is', lineItem.workCentreGroup],
                "AND",
                ["custrecord_ddc_wcl_default_at_site", "is", "T"]
              ],
              // 'OR'
            )
            xFilters.push("OR")
          }
          xFilters.pop()
          //xFilters.push('AND', ['custrecord_ddc_wcl_default_at_site', 'is', 'T'])

          log.debug('beforeSubmit >> xFilters', xFilters)

          let wcMap = workCentreMap(xFilters)
          for (lineItem of lineItems) {
            log.emergency({
              title: 'lineItem',
              details: lineItem
            })
            let idx = wcMap.findIndex(fi => fi.workCentreGroup == lineItem.workCentreGroup && fi.site == lineItem.site)
            if (idx > -1) {
              lineItem.workCentreId = wcMap[idx].id
              // lineItem.machineRate = wcMap[idx].machineRate
              // lineItem.labourRate = wcMap[idx].labourRate
              // lineItem.labourOHRate = wcMap[idx].labourOHRate
              lineItem.plannedMachine = wcMap[idx].plannedMachine
              lineItem.preferredFulfillmentBin = wcMap[idx].preferredFulfillmentBin // Aug 24, 2023 - DDC CO019
              lineItem.alternateFulfillmentBin = wcMap[idx].alternateFulfillmentBin // Aug 24, 2023 - DDC CO019
              lineItem.preferredFulfillmentBinText = wcMap[idx].preferredFulfillmentBinText // Aug 29, 2023 - DDC CO019
              lineItem.alternateFulfillmentBinText = wcMap[idx].alternateFulfillmentBinText // Aug 29, 2023 - DDC CO019
            }
          }
          log.debug('beforeSubmit >> lineItems', lineItems)

          // Map workcentre per item
          for (lineItem of lineItems) {
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', value: lineItem.workCentreId, line: lineItem.line })
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hour_rate', value: lineItem.machineRate, line: lineItem.line })
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hour_rate', value: lineItem.labourRate, line: lineItem.line })
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_rate', value: lineItem.labourOHRate, line: lineItem.line })
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine', value: lineItem.plannedMachine, line: lineItem.line })
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_pref_fulfillment_bin_id', value: lineItem.preferredFulfillmentBin, line: lineItem.line }) // v1.2.0 Added on August 22, 2023 - DDC CO019
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_alt_fulfillment_bin_id', value: lineItem.alternateFulfillmentBin, line: lineItem.line }) // v1.2.0 Added on August 22, 2023 - DDC CO019
            // Text Value Here
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_pref_fulfillment_bin', value: lineItem.preferredFulfillmentBinText, line: lineItem.line }) // v1.2.0 Added on August 29, 2023 - DDC CO019
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_alt_fulfillment_bin', value: lineItem.alternateFulfillmentBinText, line: lineItem.line }) // v1.2.0 Added on August 29, 2023 - DDC CO019
            log.debug('SET WC fields', lineItem)
          }
        }
        // }
      } catch (e) {
        log.debug('beforeSubmit error', e.message)
      }
    }

    const workCentreMap = xFilters => {
      let map = []
      var customrecord_ddc_work_centreSearchObj = search.create({
        type: "customrecord_ddc_work_centre",
        filters: xFilters,
        columns:
          [
            search.createColumn({
              name: "name",
              sort: search.Sort.ASC,
              label: "Name"
            }),
            search.createColumn({ name: "scriptid", label: "Script ID" }),
            search.createColumn({ name: "custrecord_ddc_wcl_site", label: "Site" }),
            search.createColumn({ name: "custrecord_ddc_wcl_work_centre_group", label: "Work Centre Name" }),
            search.createColumn({ name: "custrecord_ddc_wcl_item_category", label: "Item Category" }),
            search.createColumn({ name: "custrecord_ddc_wcl_default_sched_seq", label: "Default Schedule Sequence" }),
            search.createColumn({ name: "custrecord_ddc_wcl_machine", label: "Machine" }),
            search.createColumn({ name: "custrecord_ddc_wcl_default_at_site", label: "Default at Site" }),
            search.createColumn({ name: "custrecord_ddc_wcl_machine_hour_rate", label: "Machine Run Rate" }),
            search.createColumn({ name: "custrecord_ddc_wcl_labour_rate", label: "Labour Rate" }),
            search.createColumn({ name: "custrecord_ddc_wcl_labour_oh_rate", label: "Labour OH Rate" }),
            search.createColumn({ name: "custrecord_ddc_wcl_pref_if_bin", label: "Preferred Fulfillment Bin" }), // v1.2.0 Added on August 22, 2023 - DDC CO019
            search.createColumn({ name: "custrecord_ddc_wcl_alt_if_bin", label: "Alternate Fulfillment Bin" }) // v1.2.0 Added on August 22, 2023 - DDC CO019
          ]
      });
      customrecord_ddc_work_centreSearchObj.run().each(function (result) {
        map.push({
          id: result.id,
          workCentreGroup: result.getValue({ name: 'custrecord_ddc_wcl_work_centre_group' }),
          itemCategory: result.getValue({ name: 'custrecord_ddc_wcl_item_category' }),
          scheduleSequence: result.getValue({ name: 'custrecord_ddc_wcl_default_sched_seq' }),
          site: result.getValue({ name: 'custrecord_ddc_wcl_site' }),
          plannedMachine: result.getValue({ name: 'custrecord_ddc_wcl_machine' }),
          machineRate: result.getValue({ name: 'custrecord_ddc_wcl_machine_hour_rate' }),
          labourRate: result.getValue({ name: 'custrecord_ddc_wcl_labour_rate' }),
          labourOHRate: result.getValue({ name: 'custrecord_ddc_wcl_labour_oh_rate' }),
          preferredFulfillmentBin: result.getValue({ name: 'custrecord_ddc_wcl_pref_if_bin' }), // v1.2.0 Added on August 22, 2023 - DDC CO019
          alternateFulfillmentBin: result.getValue({ name: 'custrecord_ddc_wcl_alt_if_bin' }), // v1.2.0 Added on August 22, 2023 - DDC CO019
          preferredFulfillmentBinText: result.getText({ name: 'custrecord_ddc_wcl_pref_if_bin' }), // v1.2.0 Added on August 29, 2023 - DDC CO019
          alternateFulfillmentBinText: result.getText({ name: 'custrecord_ddc_wcl_alt_if_bin' }), // v1.2.0 Added on August 29, 2023 - DDC CO019

        })
        return true;
      });
      log.debug('WOC map', map)
      return map
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

    }

    const parseFloatOrZero = n => parseFloat(n) || 0

    var groupBy = (xs, key) => {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    };

    return { beforeSubmit/* , afterSubmit */ }

  });