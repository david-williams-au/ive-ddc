/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/*
 * @name:                                       run_creation_ue.js
 * @author:                                     LC
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Fri Sep 16 2022 11:59:10 AM
 *
 * Change Logs:
 *
 * Fri Sep 16 2022 11:59:10 AM       LC      Initial Creation
 */

/**
 * @deployedto Job
 */

define(['N/record', 'N/runtime', 'N/search', 'N/xml', 'N/task', './run_creation_cm', './lib/moment.min', './lib/ns.utils', 'N/format', 'N/file', 'N/ui/message', 'N/url'],
  /**
* @param{record} record
* @param{runtime} runtime
* @param{search} search
* @param{xml} xml
* @param{task} task
*/
  (record, runtime, search, xml, task, cm, moment, ns_utils, format, file, message, url) => {
    /**
     * Defines the function definition that is executed before record is loaded.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @param {Form} scriptContext.form - Current form
     * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
     * @since 2015.2
     */

    //#region 📜 Enum
    const Enum = {
      Subsidiary: {
        DDC: '2', // IVE - Data Driven Communications
      }
    };
    //#endregion

    const beforeLoad = (scriptContext) => {
      let { type, newRecord, form } = scriptContext;

      //#region 📜 Sales Order | Create a Initial Message when the Run Creation Ready is False.
      let subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      if (newRecord.type === record.Type.SALES_ORDER && [scriptContext.UserEventType.VIEW].includes(scriptContext.type) && runtime.executionContext == runtime.ContextType.USER_INTERFACE && subsidiary == Enum.Subsidiary.DDC) {
        let custbody_ddc_runs_created = newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });
        let custbody_run_creation_ready = newRecord.getValue({ fieldId: 'custbody_run_creation_ready' });
        let status = newRecord.getValue({ fieldId: 'status' });
        if (custbody_ddc_runs_created && !custbody_run_creation_ready) { // && status.match(/pending fulfill|pending bill/gi)
          let mapReduceScriptStatusURL = getMapReduceStatusPageURL({ mrScriptId: 'customscript_jcs_run_creation_mr' })
          form.addPageInitMessage({ type: message.Type.INFORMATION, message: 'Job updates are in progress. Please wait and refresh the page once they are complete. <a href="' + mapReduceScriptStatusURL + '" target="_blank">Map/Reduce Script Status</a>' });
        }

        function getMapReduceStatusPageURL({ mrScriptId }) {
          let scriptSearchObj = search.create({
            type: "script",
            filters: [["scriptid", "is", mrScriptId]],
            columns: []
          });
          let mrInternalId = '';
          scriptSearchObj.run().each(function (result) { mrInternalId = result.id; return true; });
          let host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
          return 'https://' + host + '/app/common/scripting/mapreducescriptstatus.nl?daterange=TODAY&scripttype=' + mrInternalId;
        }
      };
      //#endregion

      if (scriptContext.type == 'view') {
        let subsidiary = scriptContext.newRecord.getValue({ fieldId: 'subsidiary' });
        // log.debug("subsidiary", subsidiary);
        let isCreatedRun = scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });
        // log.debug("isCreatedRun", isCreatedRun);
        if (subsidiary != '2' || !isCreatedRun) {
          return;
        }
        form.addButton({
          id: 'custpage_testdelete',
          label: 'Delete runs',
          functionName: `let jobId = ${newRecord.id}; // JOBDDC0000121
                        console.log("JobId", jobId);
                        if (!confirm("Delete runs?")) return;
                            let runs = nlapiSearchRecord("customrecord_ddc_run", null, [
                                new nlobjSearchFilter("custrecord_ddc_run_job", null, "is", jobId)
                            ], [
                                new nlobjSearchColumn("name"),
                                new nlobjSearchColumn("custrecord_ddc_run_job")
                            ]) || [];
                            if (runs.length) {
                                let runDetails = nlapiSearchRecord("customrecord_ddc_run_detail", null, [
                                    new nlobjSearchFilter("custrecord_ddc_rd_parent_run", null, "anyof", runs.map(m => m.id))
                                ], [ 
                                    new nlobjSearchColumn("name"),
                                    new nlobjSearchColumn("custrecord_ddc_rd_parent_run")
                                ]) || [];
                                for (let runDetail of runDetails) {
                                    try {
                                        nlapiDeleteRecord("customrecord_ddc_run_detail", runDetail.id); // Will runout of governance
                                        console.log("Success", runDetail.getText("custrecord_ddc_rd_parent_run") + ">>>" + runDetail.getValue("name"));
                                    } catch(e) {
                                        console.log("Error", runDetail.getText("custrecord_ddc_rd_parent_run") + ">>>" + runDetail.getValue("name"), e.message);
                                    }
                                }
                                for (run of runs) {
                                    try {
                                        nlapiDeleteRecord("customrecord_ddc_run", run.id);
                                        console.log("Success", run.getText("custrecord_ddc_run_job") + ">>>" + run.getValue("name"));
                                    } catch(e) {
                                        console.log("Error", run.getText("custrecord_ddc_run_job") + ">>>" + run.getValue("name"), e.message);
                                    }
                                }
                            }
                            
                            var currentRec= nlapiLoadRecord(nlapiGetRecordType(),nlapiGetRecordId());
                            var orderstatus=currentRec.getFieldValue('orderstatus')
                            console.log('orderstatus',orderstatus);
                            if(orderstatus=='A'||orderstatus=='B'){
                                currentRec.setFieldValue('orderstatus', 'A');
                                currentRec.setFieldValue('custbody_ddc_runs_created', 'F');
                                currentRec.setFieldValue('custbody_run_creation_ready', 'F');
                            }
                            else{
                                currentRec.setFieldValue('custbody_ddc_runs_created', 'F');
                                currentRec.setFieldValue('custbody_run_creation_ready', 'F');
                            }            
                            nlapiSubmitRecord(currentRec, false, false);

                            window.location.reload();`
        })
      }
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
      let { oldRecord, newRecord } = scriptContext
      let { type, id } = newRecord
      let rec = record.load({ type, id })
      var subsidiary = rec.getValue({ fieldId: 'subsidiary' });
      var isRunCreated = rec.getValue({ fieldId: 'custbody_ddc_runs_created' });
      var productApprovalStatus = rec.getValue({ fieldId: 'custbody_ddc_production_approvalstatus' });
      if (isRunCreated) {
        return;
      }
      log.debug("aftersubmit subsidiary", subsidiary);
      if (subsidiary != '2') {
        return;
      }
      let jobNo = rec.getValue({ fieldId: 'custbody_ddc_job_no_without_prefix' })
      let executionContext = runtime.executionContext
      let status = {
        old: oldRecord ? oldRecord.getValue({ fieldId: 'status' }) : '',
        new: rec.getValue({ fieldId: 'status' })
      }
      let orderStatus = {
        old: oldRecord ? oldRecord.getValue({ fieldId: 'orderstatus' }) : '',
        new: rec.getValue({ fieldId: 'orderstatus' })
      }
      log.debug('------ [START] ------', { type, id, jobNo, eventType: scriptContext.type, executionContext, status, orderStatus })

      let invokeMapReduce = false
      try {
        if (scriptContext.type.match(/create|copy|edit|approve/g)) {
          if (status.old != status.new && status.new.match(/pending fulfill|pending bill/gi)) {
            if (!countRelatedRuns(id)) {
              let xmlStr = rec.getValue({ fieldId: 'custbody_ddc_run_schedule_dates' })
              let runs = jobRunSchedules(id, jobNo, xmlStr)

              if (runs.length) {
                let runDetailItems = jobRunDetailItems(runs, id)

                // Map site and run details per run schedule
                runs = runs.map(m => {
                  m.custrecord_ddc_run_site = rec.getValue({ fieldId: 'custbody_ddc_site' })
                  m.details = JSON.parse(JSON.stringify(runDetailItems)) // Clone run details per run schedule
                  return m
                })
                log.debug(`JobId:${id} => Runs for creation`, runs)
                rec.setValue({ fieldId: 'custbody_ddc_job_status', value: 2 }) // In Progress
                rec.setValue({ fieldId: 'custbody_ddc_runs_created', value: true }) // In Progress
                for (run of runs) {
                  if (cm.getRemainingUsage() < 100) {
                    invokeMapReduce = true
                    break
                  }
                  try {
                    run.id = ns_utils.createRecord(run.type, run)
                    for (detail of run.details) {
                      if (cm.getRemainingUsage() < 100) {
                        invokeMapReduce = true
                        break
                      }
                      detail.custrecord_ddc_rd_parent_run = run.id
                      detail.custrecord_ddc_rd_planned_startdate = run.custrecord_ddc_run_planned_startdate
                      detail.custrecord_ddc_rd_planned_enddate = run.custrecord_ddc_run_planned_enddate
                      detail.custrecord_ddc_rd_prod_approval_status = productApprovalStatus
                      try {
                        detail.id = ns_utils.createRecord(detail.type, detail)
                      } catch (e) {
                        log.debug(`JobId:${id} => Run detail creation error: ${detail.custrecord_ddc_rd_lineid}`, e.message)
                      }
                    }
                  } catch (e) {
                    log.debug(`JobId:${id} => Run creation error:${run.custrecord_ddc_run_id}`, e.message)
                  }
                }

                log.debug(`JobId:${id} => runs length : ${runs.length}`, runs)
                if (!invokeMapReduce) {
                  rec.setValue({ fieldId: 'custbody_run_creation_ready', value: true })
                }
                else {
                  rec.setValue({ fieldId: 'custbody_run_creation_ready', value: false })
                }

                rec.save({ ignoreMandatoryFields: true })
                if (invokeMapReduce) {
                  var tetsRun = [];
                  for (var i = 0; i < runs.length; i++) {
                    var item = runs[i];
                    var runDetails = item.details;
                    var testRunDetails = [];
                    for (var j = 0; j < runDetails.length; j++) {
                      if (runDetails[j].id == '' && item.id != '') {
                        testRunDetails.push(runDetails[j]);
                      }
                    }
                    if (testRunDetails.length > 0) {
                      item.details = testRunDetails;
                      tetsRun.push(item);
                    }

                  }
                  log.debug('tetsRun', tetsRun)

                  runs = runs
                    .filter(r => !r.id)
                    .filter(r => {// Filter out run details with internalid
                      r.details = r.details.filter(rd => !rd.id)
                      return r.details.length
                    })
                  var arr3 = [...runs, ...tetsRun];
                  arr3.map(m => cm.unParseDateValueFields(m))
                  log.debug(`JobId:${id} => MapReduce runs length : ${runs.length}`, arr3.length)
                  if (arr3.length) {
                    task.create({
                      taskType: task.TaskType.MAP_REDUCE,
                      params: {
                        custscript_jcs_run_creation_jobid: id,
                        custscript_jcs_run_creation_array: JSON.stringify(arr3)
                      },
                      scriptId: 'customscript_jcs_run_creation_mr'
                    }).submit()

                  }
                  // if (arr3.length) {
                  //     task.create({
                  //         taskType: task.TaskType.MAP_REDUCE,
                  //         params: {
                  //             custscript_jcs_run_creation_jobid: id,
                  //             custscript_jcs_run_creation_array: JSON.stringify(arr3)
                  //         },
                  //         scriptId: 'customscript_jcs_run_creation_mr'
                  //     }).submit()

                  // }
                }
              }
            }
          }
        }
      } catch (e) {
        log.debug(`JobId:${id} => afterSubmit error`, e.message)
      }
      log.debug('------ [END] ------', { id, invokeMapReduce, remainingUsage: cm.getRemainingUsage() })
    }

    const jobRunDetailItems = (runs, id) => {
      let runDetailItems = []
      var salesorderSearchObj = search.create({
        type: "salesorder",
        filters:
          [
            ["type", "anyof", "SalesOrd"],
            "AND",
            ["internalid", "anyof", id],
            "AND",
            ["custcol_ddc_stream_name", "isnotempty", ""],
            "AND",
            ["item.type", "anyof", "Service"],
            "AND",
            ["custcol_ddc_work_centre", "noneof", "@NONE@"],
            "AND",
            ["custcol_ddc_site", "noneof", "@NONE@"]
          ],
        columns:
          [
            search.createColumn({ name: "tranid", label: "Document Number" }),
            search.createColumn({ name: "item", label: "Item" }),
            search.createColumn({ name: "memo", label: "Description" }), // GR 2023-10-30 - Adding line Desc

            search.createColumn({ name: "custcol_ddc_rate", label: "DDC rate" }),
            search.createColumn({ name: "custcol_ddc_manual_rate_change", label: "Manual Rate Change" }),

            search.createColumn({ name: "custcol_ddc_quoted_qty_external", label: "Quantity" }),
            search.createColumn({ name: "custcol_ddc_stream_name", label: "Stream Name" }),
            search.createColumn({ name: "custcol_ddc_stream_number", label: "Stream Number" }),
            search.createColumn({ name: "custcol_ddc_task_group_code", label: "Task Group Code" }), //May 26 add Task Group Code
            search.createColumn({
              name: "custcol_ddc_work_centre",
              label: "Work Centre"
            }),
            search.createColumn({
              name: "custcol_ddc_site",
              label: "Site"
            }),
            search.createColumn({
              name: "custcol_ddc_item_category",
              label: "Item Category"
            }),
            //search.createColumn({ name: "line", label: "Line ID" }),
            search.createColumn({ name: "custcol_ddc_item_key_scpq", label: "Item Key" }),
            search.createColumn({
              name: "custitem_ddc_throughput_speed",
              join: "item",
              label: "Machine Throughput"
            }),
            search.createColumn({
              name: "custitem_ddc_machine_setup",
              join: "item",
              label: "Machine Setup Time"
            }),
            search.createColumn({
              name: "custitem_ddc_labour_resources",
              join: "item",
              label: "Labour Resources"
            }),
            search.createColumn({
              name: "custitem_ddc_linked_stock_item",
              join: "item",
              label: "Linked Stock Code"
            }),
            search.createColumn({
              name: "custitem_ddc_linked_ot_service",
              join: "item",
              label: "Linked OT Service"
            }),
            search.createColumn({
              name: "custitem_ddc_third_party_cost",
              join: "item",
              label: "3rd Party Cost"
            }),
            search.createColumn({
              name: "custitem_ddc_service_other_cost",
              join: "item",
              label: "Order Cost"
            }),
          ]
      });

      salesorderSearchObj = ns_utils.expandSearch(salesorderSearchObj)

      let linkedItemIDs = []
      let ItemIDMappingPlan = []
      for (let result of salesorderSearchObj) {
        //fix J
        let item = result.getValue({ name: 'item' })
        ItemIDMappingPlan.push(item);
        let linked_stock_item = result.getValue({ name: 'custitem_ddc_linked_stock_item', join: 'item' })
        let linked_ot_service = result.getValue({ name: 'custitem_ddc_linked_ot_service', join: 'item' })
        if (linked_stock_item)
          //linkedItemIDs.push(linked_stock_item)
          ////fix J
          linkedItemIDs.push(item)
        /* if (linked_ot_service)
            linkedItemIDs.push(linked_ot_service) */
      }

      let pwsq = linkedItemIDs.length ? plannedWStockQtyMap(linkedItemIDs) : {}
      let planCal = ItemIDMappingPlan.length ? plannedWPlanQtyMap(ItemIDMappingPlan) : {}
      salesorderSearchObj.forEach(result => {
        let item = result.getValue({ name: 'item' })
        let description = result.getValue({ name: 'memo' }) // GR 2023-10-30 - Adding line Desc
        let linked_stock_item = result.getValue({ name: 'custitem_ddc_linked_stock_item', join: 'item' })
        let linked_ot_service = result.getValue({ name: 'custitem_ddc_linked_ot_service', join: 'item' })
        let txQty = parseFloatOrZero(result.getValue({ name: 'custcol_ddc_quoted_qty_external' }))
        let plannedQty = txQty / (runs.length)
        let setupTime = parseFloatOrZero(result.getValue({ name: 'custitem_ddc_machine_setup', join: 'item' }))
        let machineHrs = txQty / parseFloatOrZero(result.getValue({ name: 'custitem_ddc_throughput_speed', join: 'item' }))
        let setupPlusHrs = setupTime + machineHrs
        let laborResources = parseFloatOrZero(result.getValue({ name: 'custitem_ddc_labour_resources', join: 'item' }))
        let rdPartyCost = parseFloatOrZero(result.getValue({ name: 'custitem_ddc_third_party_cost', join: 'item' }))
        let otherCost = parseFloatOrZero(result.getValue({ name: 'custitem_ddc_service_other_cost', join: 'item' }))
        let plannedTotalLabourHr = setupPlusHrs * laborResources
        let taskGroupCode = result.getValue({ name: 'custcol_ddc_task_group_code' }) //May 16 Added task group code

        let manualRate = result.getValue({ name: 'custcol_ddc_manual_rate_change' })
        let obj = {
          custrecord_ddc_rd_parent_run: '',
          custrecord_ddc_rd_item: item,
          custrecord_ddc_rd_item_desc: description, // GR 2023-10-30 - Adding line Desc
          custrecord_ddc_rd_job: id, // GR 2023-10-30 - Adding Job to RD record
          custrecord_ddc_rd_task_group_code: taskGroupCode, //May 26 added task group code
          custrecord_ddc_rd_stream_name: result.getValue({ name: 'custcol_ddc_stream_name' }),
          custrecord_ddc_rd_stream_number: result.getValue({ name: 'custcol_ddc_stream_number' }),
          custrecord_ddc_rd_work_centre: result.getValue({ name: 'custcol_ddc_work_centre' }),
          custrecord_ddc_rd_site: result.getValue({ name: 'custcol_ddc_site' }),
          custrecord_ddc_rd_item_category: result.getValue({ name: 'custcol_ddc_item_category' }),
          custrecord_ddc_rd_planned_qty: plannedQty,
          //custrecord_ddc_rd_lineid: result.getValue({ name: 'line' }),
          custrecord_ddc_rd_lineid: result.getValue({ name: 'custcol_ddc_item_key_scpq' }),
          custrecord_ddc_rd_planned_mc_throughput: result.getValue({ name: 'custitem_ddc_throughput_speed', join: 'item' }),
          custrecord_ddc_rd_planned_setup_time: setupTime,
          custrecord_ddc_rd_planned_run_machine_hr: machineHrs,
          custrecord_ddc_rd_planned_total_mach_hr: setupPlusHrs,
          custrecord_ddc_rd_planned_labour_res: laborResources,
          custrecord_ddc_rd_planned_labour_tp: plannedQty / plannedTotalLabourHr,
          custrecord_ddc_rd_planned_total_lab_hr: plannedTotalLabourHr,
          custrecord_ddc_rd_planned_w_stock_qty: '',
          custrecord_ddc_rd_planned_calc_cost: '',
          custrecord_ddc_rd_3rd_party_cost: rdPartyCost,
          custrecord_ddc_rd_other_cost: otherCost,
          custrecord_ddc_rd_manual_rate: manualRate ? parseFloatOrZero(result.getValue({ name: 'custcol_ddc_rate' })) : '',
          custrecord_ddc_rd_manual_rate_flag: result.getValue({ name: 'custcol_ddc_manual_rate_change' }),
          type: 'customrecord_ddc_run_detail',
          id: ''
        }
        log.debug("dkm1 obj ", obj);
        if (pwsq[item]) {
          let rdFormula = pwsq[item]
          if (rdFormula) {
            log.debug("co formular", "co forumlar")
            for (key in obj)
              rdFormula = rdFormula.replace(`{${key}}`, obj[key])
            try {
              log.debug("rdFormula", rdFormula);
              obj.custrecord_ddc_rd_planned_w_stock_qty = eval(rdFormula)
            } catch (e) { }
          } else {
            log.debug(" kko formular", "ko forumlar")
            obj.custrecord_ddc_rd_planned_w_stock_qty = plannedQty
          }
        }
        if (planCal[item]) {
          let rdFormula = planCal[item]
          if (rdFormula) {
            log.debug("co formular planCal", "co forumlar")
            for (key in obj)
              rdFormula = rdFormula.replace(`{${key}}`, obj[key])
            try {
              log.debug("rdFormula", rdFormula);
              obj.custrecord_ddc_rd_planned_calc_cost = eval(rdFormula)
            } catch (e) { }
          } else {
            log.debug(" kko formular", "ko forumlar")
            obj.custrecord_ddc_rd_planned_calc_cost = 0
          }
        }
        log.debug("dkm", obj);
        runDetailItems.push(obj)
      });
      log.debug("runDetailItems before remove", runDetailItems)
      var runDetailItemsNoteIncludPostage = runDetailItems.filter(x => x.custrecord_ddc_rd_item_category != "20");
      log.debug("runDetailItemsNoteIncludPostage", runDetailItemsNoteIncludPostage)
      var runDetailItemsIncludePostage = runDetailItems.filter(x => x.custrecord_ddc_rd_item_category == "20");
      log.debug("runDetailItemsIncludePostage", runDetailItemsIncludePostage)
      runDetailItemsIncludePostage = runDetailItemsIncludePostage.filter(
        (obj, index) =>
          runDetailItemsIncludePostage.findIndex((item) => item.custrecord_ddc_rd_item_category === obj.custrecord_ddc_rd_item_category && item.custrecord_ddc_rd_stream_name === obj.custrecord_ddc_rd_stream_name) === index
      );
      log.debug("runDetailItemsIncludePostage remove duplicate", runDetailItemsIncludePostage)
      Array.prototype.push.apply(runDetailItemsNoteIncludPostage, runDetailItemsIncludePostage);
      runDetailItems = runDetailItemsNoteIncludPostage
      log.debug("runDetailItems affter remove", runDetailItems)
      // Map work centre fields
      if (runDetailItems.length) {
        let xFilters = [
          ['internalid', 'anyof', Array.from(new Set(runDetailItems.map(m => m.custrecord_ddc_rd_work_centre)))]
        ]
        let wcMap = workCentreMap(xFilters)
        for (runDetailItem of runDetailItems) {
          let idx = wcMap.findIndex(fi => fi.id == runDetailItem.custrecord_ddc_rd_work_centre)
          if (idx > -1) {
            runDetailItem.custrecord_ddc_rd_sched_seq = wcMap[idx].scheduleSequence
            runDetailItem.custrecord_ddc_rd_planned_machine = wcMap[idx].plannedMachine
            runDetailItem.custrecord_ddc_rd_machine_hour_rate = wcMap[idx].machineRate
            runDetailItem.custrecord_ddc_rd_labour_hour_rate = wcMap[idx].labourRate
            runDetailItem.custrecord_ddc_rd_labour_oh_rate = wcMap[idx].labourOHRate
          }
        }
      }
      log.debug(`JobId:${id} => Run detail items`, runDetailItems)
      return runDetailItems
    }

    const plannedWStockQtyMap = ids => {
      log.debug('Linked item ids', ids)

      let columns = [],
        itemColumns = [],
        formulaMap = {}

      search.create({
        type: 'customrecord_ddc_weighted_stock_formula',
        columns: ['custrecord_ddc_wsf_formula_coded_rd']
      })
        .run().each(each => {
          formulaMap[each.id] = each.getValue({ name: 'custrecord_ddc_wsf_formula_coded_rd' })
          if (formulaMap[each.id]) {
            try {
              columns = columns.concat(formulaMap[each.id]
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length))
            } catch (e) {
            }
          }
          return true
        })
      columns = Array.from(new Set(columns))
      itemColumns = columns.filter(f => f.match(/custitem/))

      let map = {}
      search.create({
        type: 'item',
        filters: [
          ['internalid', 'anyof', ids],
          'AND',
          ['custitem_ddc_weighted_stock_formula', 'noneof', ['@NONE@', '']]
        ],
        columns: ['custitem_ddc_weighted_stock_formula'].concat(itemColumns)
      })
        .run().each(each => {
          map[each.id] = formulaMap[each.getValue({ name: 'custitem_ddc_weighted_stock_formula' })]
          for (itemColumn of itemColumns)
            map[each.id] = map[each.id].replace(`{${itemColumn}}`, parseFloatOrZero(each.getValue({ name: itemColumn })))
          return true
        })
      log.debug('Linked Items map', map)
      return map
    }
    const plannedWPlanQtyMap = ids => {
      log.debug('Linked item ids', ids)

      let columns = [],
        itemColumns = [],
        formulaMap = {}

      search.create({
        type: 'customrecord_ddc_costing_formula_list',
        columns: ['custrecord_ddc_cfl_formula_coded_rd_plan']
      })
        .run().each(each => {
          formulaMap[each.id] = each.getValue({ name: 'custrecord_ddc_cfl_formula_coded_rd_plan' })
          if (formulaMap[each.id]) {
            try {
              columns = columns.concat(formulaMap[each.id]
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length))
            } catch (e) {
            }
          }
          return true
        })
      columns = Array.from(new Set(columns))
      itemColumns = columns.filter(f => f.match(/custitem/))

      let map = {}
      search.create({
        type: 'item',
        filters: [
          ['internalid', 'anyof', ids],
          'AND',
          ['custitem_ddc_costing_formula', 'noneof', ['@NONE@', '']]
        ],
        columns: ['custitem_ddc_costing_formula'].concat(itemColumns)
      })
        .run().each(each => {
          map[each.id] = formulaMap[each.getValue({ name: 'custitem_ddc_costing_formula' })]
          for (itemColumn of itemColumns)
            map[each.id] = map[each.id].replace(`{${itemColumn}}`, parseFloatOrZero(each.getValue({ name: itemColumn })))
          return true
        })
      log.debug('Linked Items map', map)
      return map
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
            search.createColumn({ name: "custrecord_ddc_wcl_labour_oh_rate", label: "Labour OH Rate" })
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
        })
        return true;
      });
      log.debug('WOC map', map)
      return map
    }

    const jobRunSchedules = (id, jobNo, str) => {
      /* str = `<run-schedule>
          <run>
              <startdate>
                  <month>05</month>
                  <day>1</day>
                  <year>2022</year>
              </startdate>
              <enddate>
                  <month>05</month>
                  <day>30</day>
                  <year>2022</year>
              </enddate>
          </run>
          <run>
              <startdate>
                  <month>06</month>
                  <day>1</day>
                  <year>2022</year>
              </startdate>
              <enddate>
                  <month>06</month>
                  <day>30</day>
                  <year>2022</year>
              </enddate>
          </run>
      </run-schedule>` */
      str = removeXMLTagNullValues(str)
      log.debug(`JobId:${id} => XML string`, str)
      log.debug(`JobId:${id} => XML string length`, str.length)

      if (!str.length) return []
      let _runs = []

      // Serialize XML to JSON
      let xmlDocument = xml.Parser.fromString({ text: str })
      let runs = xmlDocument.getElementsByTagNameNS({
        namespaceURI: '*',
        localName: 'run'
      })
      for (i in runs) {
        let run = runs[i]
        let r = {}
        r.custrecord_ddc_run_job = id
        // 2023-10-25 - Change to ID requested by DDC-Pat
        //r.custrecord_ddc_run_id = `Job${parseInt(jobNo)} Run ${(Number(i) + 1)}` // Ex. Job88 Run 1
        r.custrecord_ddc_run_id = `${(Number(i) + 1)}` // Ex. 1
        r.custrecord_ddc_run_planned_startdate = ''
        r.custrecord_ddc_run_planned_enddate = ''

        let startDateProperties = run.getElementsByTagNameNS({ namespaceURI: '*', localName: 'startdate' })
        if (startDateProperties.length) {
          let day = startDateProperties[0].getElementsByTagNameNS({ namespaceURI: '*', localName: 'day' })
          let month = startDateProperties[0].getElementsByTagNameNS({ namespaceURI: '*', localName: 'month' })
          let year = startDateProperties[0].getElementsByTagNameNS({ namespaceURI: '*', localName: 'year' })
          day = day && day.length ? day[0].textContent : ''
          month = month && month.length ? month[0].textContent : ''
          year = year && year.length ? year[0].textContent : ''
          if (day != "" && month != "" && year != "") {
            var starDate = `${day}/${month}/${year}`;
            starDate = starDate + " " + "12:00:00 AM";
            starDate = format.parse({ value: starDate, type: format.Type.DATETIME });
            r.custrecord_ddc_run_planned_startdate = starDate
          }
          else {
            r.custrecord_ddc_run_planned_startdate = ""
          }
          //r.custrecord_ddc_run_planned_startdate = ns_utils.systemDateFormat(`${day}/${month}/${year}`, 'd')
        }

        let endDateProperties = run.getElementsByTagNameNS({ namespaceURI: '*', localName: 'enddate' })
        if (endDateProperties.length) {
          let day = endDateProperties[0].getElementsByTagNameNS({ namespaceURI: '*', localName: 'day' })
          let month = endDateProperties[0].getElementsByTagNameNS({ namespaceURI: '*', localName: 'month' })
          let year = endDateProperties[0].getElementsByTagNameNS({ namespaceURI: '*', localName: 'year' })
          day = day && day.length ? day[0].textContent : ''
          month = month && month.length ? month[0].textContent : ''
          year = year && year.length ? year[0].textContent : ''
          if (day != "" && month != "" && year != "") {
            var endDate = `${day}/${month}/${year}`;
            endDate = endDate + " " + "11:59:00 PM";
            endDate = format.parse({ value: endDate, type: format.Type.DATETIME });
            r.custrecord_ddc_run_planned_enddate = endDate
          }
          else {
            r.custrecord_ddc_run_planned_enddate = ""
          }
          //r.custrecord_ddc_run_planned_enddate = ns_utils.systemDateFormat(`${day}/${month}/${year}`, 'd')
        }
        r.type = 'customrecord_ddc_run'
        r.id = ''
        _runs.push(r)
      }
      // log.debug(`JobId:${id} => runs`, _runs)
      return _runs
    }

    const removeXMLTagNullValues = xmlStr => {
      xmlStr = xmlStr.replace(/\n|\t|\r|&#160;|&nbsp;|  /g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
      let tags = xmlStr.match(/(<.*?>)/gi)
      if (tags) {
        tags = tags.filter(f => !f.match(/\//g)) // Remove end tags
        for (tag of tags)
          xmlStr = xmlStr.replace(`${tag}${tag.replace('<', '</')}`, '')
      }
      return xmlStr
    }

    const countRelatedRuns = jobId => {
      var customrecord_ddc_runSearchObj = search.create({
        type: "customrecord_ddc_run",
        filters:
          [
            ["custrecord_ddc_run_job", "anyof", jobId]
          ],
        columns:
          [
            search.createColumn({
              name: "name",
              sort: search.Sort.ASC,
              label: "ID"
            })
          ]
      });
      var searchResultCount = customrecord_ddc_runSearchObj.runPaged().count;
      log.debug(`JobId:${jobId} => Count related runs`, searchResultCount)
      return searchResultCount
    }

    const parseFloatOrZero = n => parseFloat(n) || 0

    return { beforeLoad, afterSubmit }

  });