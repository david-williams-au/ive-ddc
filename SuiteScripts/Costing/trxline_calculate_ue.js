/**
* @NApiVersion 2.1
* @NScriptType UserEventScript
*/
/*
* @name:                                       trxline_calculate_ue.js
* @author:                                     LC
* @summary:                                    Script Description
* @copyright:                                  © Copyright by Jcurve Solutions
* Date Created:                                Wed Oct 12 2022 4:34:50 PM
*
* Change Logs:
*
* Wed Oct 12 2022 4:34:50 PM       LC      Initial Creation
* Wed Mar 29 2023                  Mayur   Added paper weight calculation logic for SO
* Thu Mar 30 2023                  Patty   Added Flat Fee Handling
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
    const beforeSubmit = scriptContext => trigger[scriptContext.newRecord.type](scriptContext)
    const trigger = {}
    trigger.estimate = context => {
      log.debug('------ [START] ------', 'QUOTE')
      try {

        var currentUser = getUserInfo();
        log.emergency({
          title: 'runtime exec and user',
          details: {
            execContext: runtime.executionContext,
            currentUser: currentUser
          }
        });
        let scriptObj = runtime.getCurrentScript();
        let getScriptParameterSubsidiary = scriptObj.getParameter({ name: 'custscript_jcs_sbsdry_fltrng' }) ? parseFloatOrZero(scriptObj.getParameter({ name: 'custscript_jcs_sbsdry_fltrng' })) : '';
        let getScriptParameterUser = scriptObj.getParameter({ name: 'custscript_jcs_usr_fltrng' }) ? parseFloatOrZero(scriptObj.getParameter({ name: 'custscript_jcs_usr_fltrng' })) : '';

        log.emergency({
          title: 'Script Runtime',
          details: {
            getScriptParameterSubsidiary,
            getScriptParameterUser
          }
        });

        let rec = context.newRecord
        let subsidiary = rec.getValue('subsidiary');
        if (subsidiary != 2) {
          return;
        }

        // May 11 2023: Added in to let the System Account do the process for SOAP Web Services.
        // Subsidiary 2(SB1)= IVE Group Limited : IVE Group Australia Pty Ltd : IVE - Data Driven Communications
        // 4842(SB1) = System Account
        if (currentUser.user_subsidiary == getScriptParameterSubsidiary || (currentUser.user_internalid == getScriptParameterUser && runtime.executionContext == 'WEBSERVICES')) {
          log.emergency({
            title: 'Passed 1 Quote',
            details: 'Passed 1 Quote'
          })
          let lineCount = rec.getLineCount({ sublistId: 'item' })
          let itemIds = [], costFormulaIDs = [];
          var weightStockMap = {};
          for (let i = 0; i < lineCount; i++) {
            // if (i == 30) {
            itemIds.push(rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }))
            var itemID = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
            var weightStockFormular = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_weighted_stock_formula', line: i })
            log.emergency({
              title: `rate ${i + 1}`,
              details: rec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i })
            })
            if (weightStockFormular) {
              weightStockMap[itemID] = weightStockFormular
            }
            // }
          }

          let itemMap = lookupItems(Array.from(new Set(itemIds)))

          for (item in itemMap) {
            costFormulaIDs.push(itemMap[item].costing_formula)
          }

          let wsMap = weightedStockFormula(itemIds, weightStockMap)
          let costingMap = costFormulaIDs.length ? costingFormulaMap(costFormulaIDs, itemIds) : {} // TODO Check Saved Search Limit and redo checking of computation for reel_width

          for (let i = 0; i < lineCount; i++) {

            let itemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
            let item_type = rec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
            let item = itemMap[itemId]
            let itemname = rec.getSublistValue({ sublistId: 'item', fieldId: 'item_display', line: i })
            let qty = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
            let amount = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
            let unit = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: i }) || 1
            let exclude_from_costing = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_from_costing', line: i })
            let plannedQtyInternal = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_estimated_qty', line: i }))
            log.audit({
              title: `${i + 1} of ${lineCount}`,
              details: {
                itemId,
                itemname,
                item
              }
            });
            if (!item) continue

            let linked_stock_item = item.linked_stock_item
            let costing_formula = item.costing_formula
            let work_centre = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i })
            //log.debug("work_centre", work_centre);
            let labour_hour_rate = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hour_rate', line: i })) || item.labour_hour_rate
            //log.debug("labour_hour_rate line " + i, labour_hour_rate);
            let labour_oh_rate = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_rate', line: i })) || item.labour_oh_rate
            //log.debug("labour_oh_rate line" + i, labour_oh_rate);

            let machine_hour_rate = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hour_rate', line: i }))
            //log.debug("machine_hour_rate line " + i, machine_hour_rate);

            //added flat fee and other cost column
            let flat_fee = itemMap[itemId].flat_fee
            //var other_cost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_other_cost	', line: i }))
            //let other_cost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_other_cost	', line: i }))
            //log.debug("flat_fee line " + i, flat_fee + ' || other_cost: ' + other_cost);

            let vars = {}

            if (!work_centre) {
              vars.custcol_ddc_labour_hour_rate = itemMap[itemId].labour_hour_rate
              vars.custcol_ddc_labour_oh_rate = itemMap[itemId].labour_oh_rate
              vars.custcol_ddc_machine_hour_rate = itemMap[itemId].machine_hour_rate
            }
            // vars.custcol_ddc_planned_labour_hr  = item.setup_item ? item.machine_setup * item.labour_resources * qty : qty / (item.machine_throughput * item.labour_resources),
            // vars.custcol_ddc_planned_machine_hr = item.setup_item ? item.machine_setup * item.labour_resources : qty / item.machine_throughput
            vars.custcol_ddc_planned_labour_hr = 0
            vars.custcol_ddc_est_labour_hrs_error_msg = ''
            vars.custcol_ddc_planned_machine_hr = 0
            vars.custcol_ddc_est_mach_hrs_error_msg = ''

            if (!exclude_from_costing) {
              if (costing_formula) {
                //log.debug("costing_formula line " + i, costing_formula);
                if (costing_formula in costingMap) {
                  //log.debug("costingMap line " + i, costingMap);
                  if (costingMap[costing_formula].est_labour_hr)
                    evaluateFormula(costingMap, costing_formula, 'est_labour_hr', rec, i, vars, 'custcol_ddc_planned_labour_hr', 'custcol_ddc_est_labour_hrs_error_msg')
                  if (costingMap[costing_formula].est_mach_hr)
                    evaluateFormula(costingMap, costing_formula, 'est_mach_hr', rec, i, vars, 'custcol_ddc_planned_machine_hr', 'custcol_ddc_est_mach_hrs_error_msg')
                }
              }
            }

            vars.custcol_ddc_labour_hr_calc = labour_hour_rate * vars.custcol_ddc_planned_labour_hr
            vars.custcol_ddc_labour_oh_hr_calc = labour_oh_rate * vars.custcol_ddc_planned_labour_hr
            vars.custcol_ddc_machine_hr_calc = machine_hour_rate * vars.custcol_ddc_planned_machine_hr
            //vars.custcol_ddc_other_cost_calc = item.other_cost * (qty / unit)
            //vars.custcol_ddc_estimated_kgs = 0
            vars.custcol_ddc_est_kg_error_msg = ''

            //May 25: FC Requested to use custcol_ddc_other_cost from the Record itself
            vars.custcol_ddc_other_cost = 0
            var thirdPartyCost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost', line: i }))
            var estimateKg = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_estimated_kgs', line: i })
            // log.debug('line ' + (i + 1), 'estimateKg: ' + estimateKg)
            log.debug(`line ${i + 1} estimateKg: `, estimateKg)
            log.audit({
              title: `line ${i + 1} estimate kg check`,
              details: {
                'thirdPartyCost': thirdPartyCost,
                'estimateKg': estimateKg
              }
            })
            if (estimateKg) {
              vars.custcol_ddc_third_party_cost_calc = parseFloatOrZero(estimateKg) * thirdPartyCost
            }
            else {
              vars.custcol_ddc_third_party_cost_calc = (qty / unit) * thirdPartyCost
            }
            log.debug('line ' + i, 'vars.custcol_ddc_third_party_cost_calc ' + vars.custcol_ddc_third_party_cost_calc)
            if (item.placehoderItem) {
              var ddcRate = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_rate', line: i })
              var rate = rec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i })

              if (!ddcRate) {
                vars.custcol_ddc_rate = rate
              }
            }


            vars.custcol_ddc_total_cost = 0//vars.custcol_ddc_labour_hr_calc + vars.custcol_ddc_labour_oh_hr_calc + vars.custcol_ddc_machine_hr_calc + vars.custcol_ddc_machine_hr_calc + vars.custcol_ddc_other_cost_calc
            vars.custcol_ddc_costing_formula_error_msg = ''

            if (!exclude_from_costing) {
              if (costing_formula) {
                if (costing_formula in costingMap) {
                  evaluateFormula(costingMap, costing_formula, 'coded_tx', rec, i, vars, 'custcol_ddc_total_cost', 'custcol_ddc_costing_formula_error_msg')
                }
              }
            }
            //log.debug("XXX vars.custcol_ddc_total_cost", vars.custcol_ddc_total_cost);
            if (flat_fee) {
              vars.custcol_ddc_other_cost_calc = vars.custcol_ddc_total_cost
              //log.debug("flat_fee == true", vars.custcol_ddc_other_cost_calc);
            } else {
              // var other_cost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_other_cost', line: i }))
              // vars.custcol_ddc_other_cost_calc = other_cost * (qty / unit)

              //May 25: FC Requested to use custcol_ddc_other_cost from the Record itself
              vars.custcol_ddc_other_cost_calc = vars.custcol_ddc_other_cost * (qty / unit)
              //log.debug("flat_fee == false", vars.custcol_ddc_other_cost + ' || ' + qty + ' || ' + unit);
            }

            vars.custcol_ddc_oh_cost = 0
            vars.custcol_ddc_direct_cost = 0
            vars.custcol_ddc_margin = 0

            if (!exclude_from_costing) {
              var islabouroh = vars.custcol_ddc_planned_labour_hr
              vars.custcol_ddc_oh_cost = (vars.custcol_ddc_planned_labour_hr || plannedQtyInternal || qty) * labour_oh_rate

              if (!islabouroh && islabouroh != 0) {
                vars.custcol_ddc_oh_cost = 0
              }
              if (vars.custcol_ddc_labour_oh_hr_calc == 0) {
                vars.custcol_ddc_oh_cost = 0
              }
              // vars.custcol_ddc_oh_cost = (vars.custcol_ddc_estimated_kgs ? (vars.custcol_ddc_labour_oh_hr_calc * vars.custcol_ddc_estimated_kgs) : (plannedQtyInternal || qty)) * labour_oh_rate
              vars.custcol_ddc_direct_cost = parseFloatOrZero(vars.custcol_ddc_total_cost) - parseFloatOrZero(vars.custcol_ddc_oh_cost)
              if (vars.custcol_ddc_total_cost == 0) {
                vars.custcol_ddc_oh_cost = 0
                vars.custcol_ddc_actual_oh_cost = 0
                vars.custcol_ddc_direct_cost = 0
                vars.custcol_ddc_actual_direct_cost = 0
              }
              vars.custcol_ddc_margin = ((amount - vars.custcol_ddc_total_cost) / amount) * 100


            }

            //May 25: FC Requested to remove rounding up to 2 decimals
            //for (k in vars) vars[k] = roundTo2(vars[k])

            // Set these fields to empty if 0
            vars.custcol_ddc_planned_labour_hr = vars.custcol_ddc_planned_labour_hr || 0
            vars.custcol_ddc_planned_machine_hr = vars.custcol_ddc_planned_machine_hr || 0

            vars = JSON.parse(JSON.stringify(vars).replace(/null/g, 0))

            log.emergency(`Sublist index: ${i}`, { item, itemname, qty, amount, unit, plannedQtyInternal, vars, exclude_from_costing, 'wsMap[itemId]': wsMap[itemId], 'costingMap[costing_formula]': costingMap[costing_formula] })
            log.emergency("vars", vars)
            // for (k in vars)
            //     if (k == 'custcol_ddc_labour_hour_rate') {
            //         log.debug("set custcol_ddc_labour_hour_rate line " + i, labour_hour_rate);
            //         rec.setSublistValue({ sublistId: 'item', fieldId: k, value: labour_hour_rate, line: i })
            //     } else if (k == 'custcol_ddc_labour_oh_rate') {
            //         log.debug("set custcol_ddc_labour_oh_rate line " + i, labour_oh_rate);
            //         rec.setSublistValue({ sublistId: 'item', fieldId: k, value: labour_oh_rate, line: i })
            //     } else if (k == 'custcol_ddc_machine_hour_rate') {
            //         log.debug("set custcol_ddc_machine_hour_rate line " + i, machine_hour_rate);
            //         rec.setSublistValue({ sublistId: 'item', fieldId: k, value: machine_hour_rate, line: i })
            //     } else {
            //         rec.setSublistValue({ sublistId: 'item', fieldId: k, value: vars[k], line: i })
            //     }
            for (k in vars)
              rec.setSublistValue({ sublistId: 'item', fieldId: k, value: vars[k], line: i })

          }
        }
      } catch (e) {
        log.emergency('Error beforeSubmit QUOTE', e.message)
      }
      log.emergency('------ [END] ------', 'QUOTE')
    }
    trigger.salesorder = context => {
      log.debug('------ [START] ------', 'JOB')
      try {

        var currentUser = getUserInfo();
        log.emergency({
          title: 'runtime exec and user',
          details: {
            execContext: runtime.executionContext,
            currentUser: currentUser
          }
        })
        let scriptObj = runtime.getCurrentScript();
        let getScriptParameterSubsidiary = scriptObj.getParameter({ name: 'custscript_jcs_sbsdry_fltrng' }) ? parseFloatOrZero(scriptObj.getParameter({ name: 'custscript_jcs_sbsdry_fltrng' })) : '';
        let getScriptParameterUser = scriptObj.getParameter({ name: 'custscript_jcs_usr_fltrng' }) ? parseFloatOrZero(scriptObj.getParameter({ name: 'custscript_jcs_usr_fltrng' })) : '';

        log.emergency({
          title: 'Script Runtime',
          details: {
            getScriptParameterSubsidiary,
            getScriptParameterUser
          }
        })

        let rec = context.newRecord
        log.debug("context.type", context.type)
        let subsidiary = rec.getValue('subsidiary');
        if (subsidiary != 2) {
          return;
        }

        // May 11 2023: Added in to let the System Account do the process for SOAP Web Services.
        // Subsidiary 2(SB1)= IVE Group Limited : IVE Group Australia Pty Ltd : IVE - Data Driven Communications
        // 4842(SB1) = System Account
        if (currentUser.user_subsidiary == getScriptParameterSubsidiary || (currentUser.user_internalid === getScriptParameterUser && runtime.executionContext === 'WEBSERVICES')) {
          log.emergency({
            title: 'Passed 1 Job',
            details: 'Passed 1 Job'
          })
          //added as part of the paper weight calculator req
          let grip = scriptObj.getParameter({ name: 'custscript_jcs_pwc_grip' });
          let bleed_width = scriptObj.getParameter({ name: 'custscript_jcs_pwc_bleed_width' });
          let bleed_height = scriptObj.getParameter({ name: 'custscript_jcs_pwc_bleed_height' });
          let waste_run_per = scriptObj.getParameter({ name: 'custscript_jcs_pwc_waste_run_per' });
          let item_stock_type = scriptObj.getParameter({ name: 'custscript_jcs_pwc_item_stock_type' });
          let lineCount = rec.getLineCount({ sublistId: 'item' })

          let createdFrom = rec.getValue({ fieldId: 'createdfrom' })
          var retQuoteMapping = {};
          if (createdFrom) {
            let quote = record.load({ type: 'estimate', id: createdFrom })
            let quote_lineCount = quote.getLineCount({ sublistId: 'item' })

            for (let i = 0; i < quote_lineCount; i++) {
              var itemId = quote.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
              var streamName = quote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });
              var streamNumber = quote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i });
              var rate = quote.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
              var amount = quote.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
              var planned_machine_setup = quote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_setup', line: i });
              var planned_labour_resources = quote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_labour_resources', line: i });
              var planned_machine_tp = quote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_tp', line: i });

              retQuoteMapping[itemId + "_" + streamName + "_" + streamNumber] = [rate, amount, planned_machine_setup, planned_labour_resources, planned_machine_tp]

            }
          }

          let itemIds = [], costFormulaIDs = []
          var weightStockMap = []
          for (let i = 0; i < lineCount; i++) {
            itemIds.push(rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }))
            var itemID = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
            var weightStockFormular = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_weighted_stock_formula', line: i })
            if (weightStockFormular) {
              weightStockMap[itemID] = weightStockFormular
            }
          }

          let itemMap = lookupItems(Array.from(new Set(itemIds)))

          for (item in itemMap) {
            costFormulaIDs.push(itemMap[item].costing_formula)
          }

          let wsMap = weightedStockFormula(itemIds, weightStockMap)
          let costingMap = costFormulaIDs.length ? costingFormulaMap(costFormulaIDs, itemIds) : {}

          for (let i = 0; i < lineCount; i++) {
            let line = i
            let itemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
            var streamName = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });
            var streamNumber = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i });
            var rateJob = rec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
            var amountJob = rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
            let item = itemMap[itemId]
            let itemname = rec.getSublistValue({ sublistId: 'item', fieldId: 'item_display', line: i })
            let qty = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
            let amount = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
            let unit = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: i })) || 1
            let exclude_from_costing = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_from_costing', line: i })
            let plannedQtyInternal = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_estimated_qty', line: i }))

            //START - added as part of the paper weight calculator req
            let print_depth = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_printdepth', line: i }));
            let print_width = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_printwidth', line: i }));
            let paper_orientation_width = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_orientation_width', line: i });
            let item_type = rec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });

            log.emergency({
              title: `item`,
              details: `${JSON.stringify(item)} + ${i}`
            })
            if (!item) continue

            let linked_stock_item = item.linked_stock_item
            let costing_formula = item.costing_formula
            let work_centre = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', line: i })
            let labour_hour_rate = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hour_rate', line: i })) || item.labour_hour_rate
            let labour_oh_rate = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_rate', line: i })) || item.labour_oh_rate
            let machine_hour_rate = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hour_rate', line: i }))
            var actualQuanity = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i }))
            var qty_external = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_quoted_qty_external', line: i }))

            log.emergency({
              title: 'work_centre',
              details: `${work_centre} ${i}`
            })
            if (actualQuanity && qty_external) {
              var quantityVariance = actualQuanity - qty_external
            }
            else {
              var quantityVariance = 0;
            }

            //added flat fee and other cost
            let flat_fee = itemMap[itemId].flat_fee
            let other_cost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_other_cost	', line: i }))
            log.debug("flat_fee line " + i, flat_fee);

            let vars = {}

            if (!work_centre) {
              vars.custcol_ddc_labour_hour_rate = item.labour_hour_rate
              vars.custcol_ddc_labour_oh_rate = item.labour_oh_rate
              vars.custcol_ddc_machine_hour_rate = item.machine_hour_rate
            }

            // vars.custcol_ddc_planned_labour_hr  = item.setup_item ? item.machine_setup * item.labour_resources * qty : qty / (item.machine_throughput * item.labour_resources),
            // vars.custcol_ddc_planned_machine_hr = item.setup_item ? item.machine_setup * item.labour_resources : qty / item.machine_throughput
            vars.custcol_ddc_planned_labour_hr = 0
            vars.custcol_ddc_est_labour_hrs_error_msg = ''
            vars.custcol_ddc_planned_machine_hr = 0
            vars.custcol_ddc_est_mach_hrs_error_msg = ''
            vars.custcol_ddc_actual_labour_hr_total = 0;
            //1

            //May 25: FC Requested to use custcol_ddc_other_cost from the Record itself
            vars.custcol_ddc_other_cost = 0

            log.emergency({
              title: 'LOG CURRENT VARS VALUE 1 ' + i,
              details: vars
            })

            vars.custcol_ddc_quantity_variance = quantityVariance
            if (!exclude_from_costing) {
              if (costing_formula) {
                if (costing_formula in costingMap) {
                  if (costingMap[costing_formula].act_labour_hr)
                    ////J 13_09_2023
                    //evaluateFormula(costingMap, costing_formula, 'act_labour_hr', rec, i, vars, 'custcol_ddc_planned_labour_hr', 'custcol_ddc_est_labour_hrs_error_msg')
                    if (!work_centre) {
                      evaluateFormula(costingMap, costing_formula, 'act_labour_hr', rec, i, vars, 'custcol_ddc_actual_labour_hr_total', 'custcol_ddc_est_labour_hrs_error_msg')

                    }
                    else {
                      vars.custcol_ddc_actual_labour_hr_total = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_labour_hr_total', line: i })
                    }
                  if (costingMap[costing_formula].act_mach_hr)
                    if (!work_centre) {
                      evaluateFormula(costingMap, costing_formula, 'act_mach_hr', rec, i, vars, 'custcol_ddc_actual_machine_hr_total', 'custcol_ddc_est_mach_hrs_error_msg')

                    }
                    else {
                      vars.custcol_ddc_actual_machine_hr_total = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', line: i })
                    }
                  //evaluateFormula(costingMap, costing_formula, 'act_mach_hr', rec, i, vars, 'custcol_ddc_planned_machine_hr', 'custcol_ddc_est_mach_hrs_error_msg')


                }
              }
            }

            log.emergency({
              title: 'LOG CURRENT VARS VALUE 2 ' + i,
              details: vars
            })


            vars.custcol_ddc_actual_kgs = 0
            vars.custcol_ddc_est_kg_error_msg = ''



            //     if (actualQuanity > 0) {
            //        if (itemId in wsMap)
            //         evaluateFormula(wsMap, itemId, 'coded_tx', rec, i, vars, 'custcol_ddc_actual_kgs', 'custcol_ddc_est_kg_error_msg')
            //    } else {
            //       vars.custcol_ddc_actual_kgs = '';
            //     }


            if (itemId in wsMap)
              evaluateFormula(wsMap, itemId, 'coded_tx', rec, i, vars, 'custcol_ddc_actual_kgs', 'custcol_ddc_est_kg_error_msg')
            if (item_type == 'InvtPart' && parseFloatOrZero(vars.custcol_ddc_actual_kgs) > 0) {

              if (actualQuanity > 0) {

                //vars.custcol_ddc_actual_kgs = vars.custcol_ddc_estimated_kgs
                vars.custcol_ddc_billable_qty_manual = vars.custcol_ddc_actual_kgs
                vars.quantity = vars.custcol_ddc_actual_kgs
              } else {
                vars.custcol_ddc_actual_kgs = ''
              }
            }
            var _3rd_pt_cost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost', line: i }))
            log.debug("vars.custcol_ddc_actual_kgs", vars.custcol_ddc_actual_kgs);
            if (vars.custcol_ddc_actual_kgs) {
              vars.custcol_ddc_act_3party_cost_calc_tot = parseFloatOrZero(vars.custcol_ddc_actual_kgs) * _3rd_pt_cost
            }
            else {
              vars.custcol_ddc_act_3party_cost_calc_tot = (parseFloatOrZero(actualQuanity / unit) * _3rd_pt_cost)

            }



            vars.custcol_ddc_actual_total_cost = 0//vars.custcol_ddc_labour_hr_calc + vars.custcol_ddc_labour_oh_hr_calc + vars.custcol_ddc_machine_hr_calc + vars.custcol_ddc_machine_hr_calc + vars.custcol_ddc_other_cost_calc
            vars.custcol_ddc_costing_formula_error_msg = ''


            if (!exclude_from_costing) {
              if (costing_formula) {
                if (costing_formula in costingMap) {
                  evaluateFormula(costingMap, costing_formula, 'coded_j', rec, i, vars, 'custcol_ddc_actual_total_cost', 'custcol_ddc_costing_formula_error_msg')
                }
              }
            }


            log.emergency({
              title: 'LOG CURRENT VARS VALUE 3 ' + i,
              details: vars
            });

            vars.custcol_ddc_actual_oh_cost = 0
            vars.custcol_ddc_actual_direct_cost = 0
            vars.custcol_ddc_margin = 0


            log.emergency({
              title: 'LOG CURRENT VARS VALUE 4 ' + i,
              details: vars
            });

            //added flat fee
            if (flat_fee) {
              vars.custcol_ddc_act_oth_cost_calc_tot = vars.custcol_ddc_actual_total_cost
            } else {
              //vars.custcol_ddc_act_oth_cost_calc_tot = item.other_cost * (actualQuanity / unit)

              //May 25: FC Requested to use custcol_ddc_other_cost from the Record itself
              vars.custcol_ddc_act_oth_cost_calc_tot = vars.custcol_ddc_other_cost * (actualQuanity / unit)
            }


            //vars.custcol_ddc_actual_labour_hr_total =parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_labour_hr_total', line: i }))
            log.debug('custcol_ddc_actual_labour_hr_total || custcol_ddc_planned_labour_hr', vars.custcol_ddc_actual_labour_hr_total + ' || ' + vars.custcol_ddc_planned_labour_hr)
            //21_06_2023

            vars.custcol_ddc_actual_labour_hr_calc_tot = labour_hour_rate * vars.custcol_ddc_actual_labour_hr_total
            //21_06_2023
            vars.custcol_ddc_act_labour_oh_hr_calc_tot = labour_oh_rate * vars.custcol_ddc_actual_labour_hr_total

            log.debug(`Sublist index: ${i}` + "exclude_from_costing", exclude_from_costing)
            if (!exclude_from_costing) {
              vars.custcol_ddc_actual_oh_cost = vars.custcol_ddc_actual_labour_hr_total * labour_oh_rate
              vars.custcol_ddc_actual_direct_cost = vars.custcol_ddc_actual_total_cost - vars.custcol_ddc_actual_oh_cost
              vars.custcol_ddc_margin = ((amount - vars.custcol_ddc_actual_total_cost) / amount) * 100
            }
            log.emergency({
              title: 'LOG CURRENT VARS VALUE 5 ' + i,
              details: vars
            });
            //
            //vars.custcol_ddc_actual_machine_hr_total = vars.custcol_ddc_planned_machine_hr || ''

            ///vars.custcol_ddc_actual_machine_hr_total = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', line: i }))
            var machineHrTotal = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', line: i }))

            vars.custcol_ddc_planned_machine_hr = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_hr', line: i }))
            //21_06_2023
            //vars.custcol_ddc_act_machine_hr_calc_tot = machine_hour_rate * vars.custcol_ddc_actual_machine_hr_total
            vars.custcol_ddc_act_machine_hr_calc_tot = machine_hour_rate * machineHrTotal
            ///21_06_2023
            //vars.custcol_ddc_machine_hr_variance = vars.custcol_ddc_actual_machine_hr_total - vars.custcol_ddc_planned_machine_hr

            vars.custcol_ddc_machine_hr_variance = machineHrTotal - vars.custcol_ddc_planned_machine_hr
            //
            var machine_througput = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_throughput', line: i }))
            if (context.type == "edit") {
              machine_througput = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })) / parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', line: i }))
              vars.custcol_ddc_actual_machine_throughput = machine_througput


            }

            var machine_tp = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_tp', line: i }))
            //3
            vars.custcol_ddc_machine_througput_var = machine_througput - machine_tp
            //4
            var plannedLabourHr = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_labour_hr', line: i }))

            vars.custcol_ddc_labour_hr_variance = vars.custcol_ddc_actual_labour_hr_total - plannedLabourHr
            //5
            log.emergency({
              title: 'LOG CURRENT VARS VALUE 6 ' + i,
              details: vars
            });
            var quoteMapping = retQuoteMapping[itemId + "_" + streamName + "_" + streamNumber];
            log.debug("quoteMapping", quoteMapping);
            if (quoteMapping) {
              var rateQuote = quoteMapping[0];
              var amountQuote = quoteMapping[1];
              var machineSetup = quoteMapping[2]
              var labourResources = quoteMapping[3];
              var plannedMachineTp = quoteMapping[4];
              vars.custcol_ddc_rate_variance = parseFloatOrZero(rateJob) - parseFloatOrZero(rateQuote);
              vars.custcol_ddc_total_variance = parseFloatOrZero(amountJob) - parseFloatOrZero(amountQuote);

              vars.custcol_ddc_planned_machine_setup = machineSetup
              vars.custcol_ddc_planned_labour_resources = labourResources
              vars.custcol_ddc_planned_machine_tp = plannedMachineTp

              //testing for actual machine columns
              vars.custcol_ddc_actual_machine_setup = machineSetup
              vars.custcol_ddc_actual_labour_resources = labourResources
            }

            vars = JSON.parse(JSON.stringify(vars).replace(/null/g, 0))
            if (vars.custcol_ddc_actual_total_cost == 0) {
              vars.custcol_ddc_actual_oh_cost = 0
              vars.custcol_ddc_actual_direct_cost = 0

            }
            log.debug(`Sublist index: ${i}`, { item, itemname, qty, amount, unit, plannedQtyInternal, vars, exclude_from_costing, 'wsMap[itemId]': wsMap[itemId], 'costingMap[costing_formula]': costingMap[costing_formula] })
            log.emergency(`Sublist index: ${i}`, { item, itemname, qty, amount, unit, plannedQtyInternal, vars, exclude_from_costing, 'wsMap[itemId]': wsMap[itemId], 'costingMap[costing_formula]': costingMap[costing_formula] })

            for (k in vars) //JCS Added handling for planned columns
              if (k == 'custcol_ddc_planned_labour_hr') {
                continue
              } else if (k == 'custcol_ddc_planned_machine_hr') {
                continue
              } else if (k == 'custcol_ddc_actual_machine_hr_total' && work_centre) {
                continue
              } else if (k == 'custcol_ddc_actual_labour_hr_total' && work_centre) {
                continue
              } else if (k == 'custcol_ddc_planned_labour_resources') {
                continue
              } else if (k == 'custcol_ddc_planned_machine_tp') {
                continue
              } else if (k == 'custcol_ddc_planned_machine_setup') {
                continue
              } else {
                rec.setSublistValue({ sublistId: 'item', fieldId: k, value: vars[k], line: i })
              }

            //if Stock type == paper-reel and item is inventory then only calculate the paper weight
            log.audit("itemMap[itemId].type::" + itemMap[itemId].type, "itemMap[itemId].stock_type::" + itemMap[itemId].stock_type);
            log.emergency("itemMap[itemId].type::" + itemMap[itemId].type, "itemMap[itemId].stock_type::" + itemMap[itemId].stock_type);
            // if (item_type == 'InvtPart' && itemMap[itemId].stock_type == item_stock_type) {
            if (item_type == 'Service') {

              var linkStockitemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_linked_stock_item', line: i })
              log.audit("dkm linkStockitemId", linkStockitemId);
              var printDepth = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_printdepth', line: i })
              var printWidth = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_printwidth', line: i })
              var workCentreGroup = rec.getSublistText({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre_group', line: i })
              log.debug('dkm workCentreGroup', workCentreGroup)
              if (printDepth && printWidth && workCentreGroup.includes("HSCC") && linkStockitemId) {
                itemId = linkStockitemId
              }
              else {
                continue;
              }
            }
            log.emergency({
              title: 'itemId',
              details: itemId
            })
            log.emergency({
              title: 'itemMap',
              details: itemMap[itemId]
            })
            log.emergency({
              title: 'item_stock_type',
              details: item_stock_type
            });
            log.emergency({
              title: 'item_type',
              details: item_type
            });

            if ((item_type == 'InvtPart' && itemMap[itemId].stock_type == item_stock_type) || (item_type == 'Service')) {
              log.emergency({
                title: 'pass invt part',
                details: 'pass'
              })
              let reel_width = parseFloatOrZero(itemMap[itemId].reel_width);
              let gsm = parseFloatOrZero(itemMap[itemId].gsm);
              let weight_per_reel = parseFloatOrZero(itemMap[itemId].weight_per_reel);
              let paper_req_per_LM;


              if (paper_orientation_width == true || paper_orientation_width == "T") {
                //calculate the paper using Width Measurement" strategy
                log.audit("number across weight formula::", '((' + reel_width + ' - ((' + grip + ' * 2) + ' + bleed_width + ')) / (' + print_width + ' + ' + bleed_width + '))');
                let number_across = Math.round((reel_width - ((grip * 2) + bleed_width)) / (print_width + bleed_width));
                paper_req_per_LM = Math.ceil(((actualQuanity * (print_depth + bleed_height)) / number_across) / 1000);
                log.audit("number_across::", number_across);
                log.audit("paper_req_per_LM weight formula::", '((' + actualQuanity + ' * (' + print_depth + ' + ' + bleed_height + ')) / ' + number_across + ') / 1000)');

              }
              else {
                //calculate the paper using Height Measurement" strategy 
                log.audit("number across Height formula::", '((' + reel_width + ' - ((' + grip + ' * 2) + ' + bleed_width + ')) / (' + print_depth + ' + ' + bleed_width + '))');
                let number_across = Math.round((reel_width - ((grip * 2) + bleed_width)) / (print_depth + bleed_width));
                paper_req_per_LM = Math.ceil(((actualQuanity * (print_width + bleed_height)) / number_across) / 1000);
                log.audit("number_across::", number_across);
                log.audit("paper_req_per_LM Height formula::", '((' + actualQuanity + ' * (' + print_width + ' + ' + bleed_height + ')) / ' + number_across + ') / 1000)');
              }
              log.audit("paper_Req_per_LM", paper_req_per_LM);
              log.emergency({
                title: 'paper_req_per_LM',
                details: paper_req_per_LM
              })

              if (paper_req_per_LM) {
                //a. Calculate the Linear Meters of Run waste 
                let run_waste_LM = (paper_req_per_LM * waste_run_per) / 100;
                log.audit("run_waste_LM", run_waste_LM);

                //b. Add Paper Required (from Appendix B Part 3) to the Run waste (a) = ReqLMInclWaste (b)
                let req_LM_inc_waste = paper_req_per_LM + run_waste_LM;
                rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_linear_metres_j', value: req_LM_inc_waste, line: i });
                log.audit("req_LM_inc_waste", req_LM_inc_waste);
                //c. Convert Length to Kg's
                let req_KGs_inc_waste = req_LM_inc_waste * reel_width * gsm / 1000000;
                rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_kgs', value: req_KGs_inc_waste, line: i });
                var _3rd_pt_cost = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost', line: i }))
                var thirdPartyCost;
                if (req_KGs_inc_waste) {
                  thirdPartyCost = req_KGs_inc_waste * _3rd_pt_cost
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_3party_cost_calc_tot', value: thirdPartyCost, line: i });
                }
                else {
                  var quantity = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
                  thirdPartyCost = (quantity / (unit || 1)) * _3rd_pt_cost
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_3party_cost_calc_tot', value: thirdPartyCost, line: i });
                }

                if (item_type == 'Service') {

                  var thirdPartyCost = req_KGs_inc_waste * itemMap[itemId]._3rd_pt_cost
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_3party_cost_calc_tot', value: thirdPartyCost, line: i });
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost', value: itemMap[itemId]._3rd_pt_cost, line: i });

                } else {
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_3party_cost_calc_tot', value: 0, line: i });
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost_calc', value: 0, line: i });
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: req_KGs_inc_waste, line: i });
                  rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_billable_qty_manual', value: req_KGs_inc_waste, line: i });
                }

                log.audit("req_KGs_inc_waste", req_KGs_inc_waste);

                //d. Convert Kg's to number of rolls to enable calculation of Lead in and lead out waste
                let run_inc_wate_reels = Math.ceil((parseFloat(req_KGs_inc_waste) / parseFloat(weight_per_reel)) * 10) / 10;
                run_inc_wate_reels = isFinite(run_inc_wate_reels) ? run_inc_wate_reels : 0;
                log.audit("run_inc_wate_reels formula ", 'Math.ceil(((' + parseFloat(req_KGs_inc_waste) + '/' + parseFloat(weight_per_reel) + ') * 10) / 10');
                rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_paper_reels_req_j', value: run_inc_wate_reels, line: i });
                log.audit("run_inc_wate_reels", run_inc_wate_reels);
              }
            }

            //END - added as part of the paper weight calculator req
          }
        }
      } catch (e) {
        log.debug('Error beforeSubmit JOB', e.message)
      }
      log.debug('------ [END] ------', 'JOB')
    }
    const getDecimalPart = (num) => {
      if (Number.isInteger(num)) {
        return 0;
      }

      const decimalStr = num.toString().split('.')[1];
      return Number(decimalStr);
    }
    const lookupItems = ids => {
      let map = {}
      search.create({
        type: 'item',
        filters: [
          ['internalid', 'anyof', ids]
        ],
        columns: [
          'itemid',
          'custitem_ddc_setup_item',
          'custitem_ddc_labour_resources',
          'custitem_ddc_machine_setup',
          'custitem_ddc_throughput_speed',
          'custitem_ddc_third_party_cost',
          'custitem_ddc_service_other_cost',
          'custitem_ddc_labour_hour_rate',
          'custitem_ddc_labour_oh_rate',
          'custitem_ddc_linked_stock_item',
          'custitem_ddc_weighted_stock_formula',
          'custitem_ddc_costing_formula',
          'custitem_ddc_machine_hour_rate',
          'custitem_ddc_stock_type', //added as part of the paper weight calculator req
          'custitem_ive_paper_width', //added as part of the paper weight calculator req
          'custitem_ddc_paper_gsm', //added as part of the paper weight calculator req
          "custitem_ive_item_kgs_per_reel",//added as part of the paper weight calculator req
          'custitem_ddc_item_flatfee', //added flat fee
          'custitem_ddc_placeholder_item',
          'custitem_ddc_lsi_width_mm'
        ]
      })
        .run().each(each => {
          map[each.id] = {
            type: each.recordType,
            itemid: each.getValue({ name: 'itemid' }),
            setup_item: each.getValue({ name: 'custitem_ddc_setup_item' }),
            labour_resources: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_labour_resources' }))),
            machine_setup: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_machine_setup' }))),
            machine_throughput: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_throughput_speed' }))),
            _3rd_pt_cost: (parseFloatOrZero(each.getValue({ name: 'custitem_ddc_third_party_cost' }))),
            other_cost: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_service_other_cost' }))),
            labour_hour_rate: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_labour_hour_rate' }))),
            labour_oh_rate: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_labour_oh_rate' }))),
            machine_hour_rate: roundTo2(parseFloatOrZero(each.getValue({ name: 'custitem_ddc_machine_hour_rate' }))),
            linked_stock_item: each.getValue({ name: 'custitem_ddc_linked_stock_item' }),
            costing_formula: each.getValue({ name: 'custitem_ddc_costing_formula' }),
            stock_formula: each.getValue({ name: 'custitem_ddc_weighted_stock_formula' }),
            stock_type: each.getValue({ name: 'custitem_ddc_stock_type' }),//added as part of the paper weight calculator req
            reel_width: each.recordType == 'serviceitem' ? each.getValue({ name: 'custitem_ddc_lsi_width_mm' }) : each.getValue({ name: 'custitem_ive_paper_width' }),//added as part of the paper weight calculator req
            gsm: each.getValue({ name: 'custitem_ddc_paper_gsm' }),//added as part of the paper weight calculator req
            weight_per_reel: each.getValue({ name: 'custitem_ive_item_kgs_per_reel' }),//added as part of the paper weight calculator req
            flat_fee: each.getValue({ name: 'custitem_ddc_item_flatfee' }), //added flat fee,
            placehoderItem: each.getValue({ name: 'custitem_ddc_placeholder_item' }), //added flat fee
            lsi_width: each.getValue({ name: 'custitem_ddc_lsi_width_mm' })
          }
          return true
        })
      log.debug('Item Map', map)
      return map
    }

    const weightedStockFormula = (ids, weightStockMap) => {
      ids = Array.from(new Set(ids)).filter(f => f != null && f != "") // Remove dups and remove nulls
      log.debug('weightedStockFormula item ids', ids)
      if (!ids.length) return {}

      let columns = [],
        itemColumns = [],
        formulaMap = {}

      search.create({
        type: 'customrecord_ddc_weighted_stock_formula',
        columns: [
          'custrecord_ddc_wsf_formula_coded_tx'
        ]
      })
        .run().each(each => {
          formulaMap[each.id] = {
            coded_tx: each.getValue({ name: 'custrecord_ddc_wsf_formula_coded_tx' })
          }
          try {
            if (formulaMap[each.id].coded_tx)
              columns = columns.concat(formulaMap[each.id].coded_tx
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
          } catch (e) {
            // log.debug('INVALID FORMULA', e.message)
          }
          return true
        })
      log.debug('weightedStockFormula formulaMap columns', columns)
      columns = Array.from(new Set(columns))
      itemColumns = columns.filter(f => f.match(/custitem/))
      let map = {}
      search.create({
        type: 'item',
        filters: [
          ['internalid', 'anyof', ids]
        ],
        columns: ['custitem_ddc_weighted_stock_formula'].concat(itemColumns)
      })
        .run().each(each => {
          log.debug("each", each.id)
          //let stock_formula = each.getValue({ name: 'custitem_ddc_weighted_stock_formula' })
          let stock_formula = weightStockMap[each.id]
          if (stock_formula) {
            map[each.id] = {
              coded_tx: ''
            }
            if (formulaMap[stock_formula]) {
              map[each.id].coded_tx = formulaMap[stock_formula].coded_tx
            }
            for (itemColumn of itemColumns) {
              let val = parseFloatOrZero(each.getValue({ name: itemColumn }))
              for (key in map[each.id])
                map[each.id][key] = map[each.id][key].replace(`{${itemColumn}}`, val)
            }
          }

          return true
        })
      log.debug('weightedStockFormula map', map)
      return map
    }

    const costingFormulaMap = (ids, itemIds) => {

      ids = Array.from(new Set(ids)).filter(f => f != null && f != "") // Remove dups and remove nulls
      log.debug('costingFormulaMap ids', ids)
      if (!ids.length) return {}

      let columns = [],
        itemColumns = [],
        formulaMap = {}

      search.create({
        type: 'customrecord_ddc_costing_formula_list',
        filters: [
          ['internalid', 'anyof', ids]
        ],
        columns: [
          'custrecord_ddc_cfl_formula_coded_tx',
          'custrecord_ddc_cfl_formula_est_labour_hr',
          'custrecord_ddc_cfl_formula_est_mach_hr',
          'custrecord_ddc_cfl_formula_coded_j', //JCS ADDED FORMULAS FOR JOB
          'custrecord_ddc_cfl_formula_act_labour_hr',
          'custrecord_ddc_cfl_formula_act_mach_hr'
        ]
      })
        .run().each(each => {
          formulaMap[each.id] = {
            coded_tx: each.getValue({ name: 'custrecord_ddc_cfl_formula_coded_tx' }),
            est_labour_hr: each.getValue({ name: 'custrecord_ddc_cfl_formula_est_labour_hr' }),
            est_mach_hr: each.getValue({ name: 'custrecord_ddc_cfl_formula_est_mach_hr' }),
            coded_j: each.getValue({ name: 'custrecord_ddc_cfl_formula_coded_j' }),
            act_labour_hr: each.getValue({ name: 'custrecord_ddc_cfl_formula_act_labour_hr' }),
            act_mach_hr: each.getValue({ name: 'custrecord_ddc_cfl_formula_act_mach_hr' }),
          }
          try {
            if (formulaMap[each.id].coded_tx)
              columns = columns.concat(formulaMap[each.id].coded_tx
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
            if (formulaMap[each.id].est_labour_hr)
              columns = columns.concat(formulaMap[each.id].est_labour_hr
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
            if (formulaMap[each.id].est_mach_hr)
              columns = columns.concat(formulaMap[each.id].est_mach_hr
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
            if (formulaMap[each.id].coded_j)
              columns = columns.concat(formulaMap[each.id].coded_j
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
            if (formulaMap[each.id].act_labour_hr)
              columns = columns.concat(formulaMap[each.id].act_labour_hr
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
            if (formulaMap[each.id].act_mach_hr)
              columns = columns.concat(formulaMap[each.id].act_mach_hr
                .replace(/ /g, '')
                .split(/{|}|\+|\-|\*|\/|\(|\)/g)
                .filter(f => f.length && isNaN(parseFloat(f))))
          } catch (e) {
            // log.debug('INVALID FORMULA', e.message)
          }
          return true
        })
      columns = Array.from(new Set(columns))
      itemColumns = columns.filter(f => f.match(/custitem/))

      let map = {}
      // Inventory and Services sourcing 
      search.create({
        type: 'item',
        filters: [
          ['internalid', 'anyof', itemIds],
          "AND",
          ['custitem_ddc_costing_formula', 'anyof', ids]
        ],
        columns: ['custitem_ddc_costing_formula'].concat(itemColumns)
      })
        .run().each(each => {
          let costing_formula = each.getValue({ name: 'custitem_ddc_costing_formula' })
          map[costing_formula] = {
            coded_tx: '',
            est_labour_hr: '',
            est_mach_hr: '',
            coded_j: '',
            act_labour_hr: '',
            act_mach_hr: ''
          }
          if (formulaMap[costing_formula]) {
            map[costing_formula].coded_tx = formulaMap[costing_formula].coded_tx
            map[costing_formula].est_labour_hr = formulaMap[costing_formula].est_labour_hr
            map[costing_formula].est_mach_hr = formulaMap[costing_formula].est_mach_hr
            map[costing_formula].coded_j = formulaMap[costing_formula].coded_j
            map[costing_formula].act_labour_hr = formulaMap[costing_formula].act_labour_hr
            map[costing_formula].act_mach_hr = formulaMap[costing_formula].act_mach_hr
          }
          for (itemColumn of itemColumns) {
            let val = parseFloatOrZero(each.getValue({ name: itemColumn }))
            for (key in map[costing_formula])
              map[costing_formula][key] = map[costing_formula][key].replace(`{${itemColumn}}`, val)
          }
          return true
        })
      log.debug('costingFormulaMap map', map)
      return map
    }

    const evaluateFormula = (map, custRecId, mapKey, rec, i, vars, fieldId, fieldIdErr) => {
      //log.debug('evaluateFormula args', arguments)
      log.debug('evaluateFormula map', map)
      log.debug('evaluateFormula fieldId', fieldId)
      //log.debug('rec', rec)
      //get Value from the record
      var recordType = rec.type
      log.debug('recordType', recordType)
      let formulaStr = map[custRecId][mapKey]
      let origFormula = JSON.parse(JSON.stringify(formulaStr))
      let fieldFormula = map[custRecId][mapKey]
      if (fieldFormula) {
        let fieldIds = fieldFormula.replace(/ /g, '')
          .split(/{|}|\+|\-|\*|\/|\(|\)/g)
          .filter(f => f.length && isNaN(parseFloat(f)))
        log.debug('fieldIds', fieldIds)
        for (key of fieldIds) {
          let val = vars[key] || parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: key, line: i }))
          if (key == 'quantity') {
            log.debug('key', `{${key}}` + ' || val: ' + val)
            log.debug('val', val)
            log.debug('val', parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: key, line: i })))
            if (recordType == 'salesorder' && fieldId == 'custcol_ddc_actual_kgs') {
              val = parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i }))
            }

          }
          if (fieldId.match(/custcol_ddc_planned_labour_hr|custcol_ddc_planned_machine_hr/g)) {
            if (isEmpty(val)) {
              val = 1
              log.debug('key', `{${key}}` + ' || val: ' + val)
            }
            // val = val || 1
          }

          log.debug('key', `{${key}}` + ' || val: ' + val)

          //May 25: FC Requested to use custcol_ddc_other_cost from the Record itself

          if (key.match('custcol_ddc_other_cost')) {
            vars.custcol_ddc_other_cost = val

            log.debug('add other cost to vars', vars)
          }
          // log.debug('before replace', fieldFormula)
          // log.debug('before replace val', val)
          fieldFormula = fieldFormula.replace(`{${key}}`, val)
        }
        try {
          vars[fieldId] = eval(fieldFormula)
          log.debug('vars[fieldId]', fieldId + "is equal :" + vars[fieldId])

        } catch (e) {
          vars[fieldIdErr] = `Couldn't Evaluate/Invalid Formula\n\nFormula: ${origFormula}\n\nJS Error: ${e.message}`
        }
      }
    }

    function roundTo2(n) {
      var negative = false;
      if (n < 0) {
        negative = true;
        n = n * -1;
      }
      var multiplicator = Math.pow(10, 2);
      n = parseFloat((n * multiplicator).toFixed(11));
      n = (Math.round(n) / multiplicator).toFixed(2);
      if (negative) {
        n = (n * -1).toFixed(2);
      }
      return parseFloatOrZero(n);
    }

    const parseFloatOrZero = n => parseFloat(n) || 0
    function isEmpty(value) {
      return (value == null || value === '');
    }

    const getUserInfo = () => {
      let getUser = runtime.getCurrentUser();
      let userData = {
        user_subsidiary: getUser.subsidiary,
        user_internalid: getUser.id
      }
      return userData
    }

    return { beforeSubmit }

  });