/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/*
* @name:                                       trxbody_calculate_ue.js
* @author:                                     LC
* @summary:                                    Script Description
* @copyright:                                  © Copyright by Jcurve Solutions
* Date Created:                                Wed Oct 12 2022 4:34:50 PM
*
* Change Logs:
*
* Wed Oct 12 2022 4:34:50 PM       LC      Initial Creation
* Wed Nov 30 2022 9:33:00 AM       LC      Changes -> https://trello.com/c/L6NJJSAn/1068-support-002466-ddc-costing-frd-customisations
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
        let { oldRecord, newRecord } = context
        let { type, id } = newRecord
        // let subsidiary=newRecord.getValue('subsidiary');
        // if(subsidiary!=2){
        //     return;
        // }
        // let lineCount = newRecord.getLineCount({ sublistId: 'item' })
        // let total = parseFloatOrZero(newRecord.getValue({ fieldId: 'total' }))
        // let taxtotal = parseFloatOrZero(newRecord.getValue({ fieldId: 'taxtotal' }))
        // let subtotal = parseFloatOrZero(newRecord.getValue({ fieldId: 'subtotal' }))
        // let unitpriceQty = parseFloatOrZero(newRecord.getValue({ fieldId: 'custbody_ddc_unit_price_quantity' }))
        // let unitPriceManual = parseFloatOrZero(newRecord.getValue({ fieldId: 'custbody_manual_unit_price' }))
        // let unitPriceCalc = unitpriceQty ? ((total - taxtotal) / unitpriceQty) : 0

        // let vars = {
        //     custbody_ddc_unit_price_calc: unitPriceCalc,
        //     custbody_ddc_unit_price_amount: (unitPriceManual) ? (unitPriceManual * unitpriceQty) : (unitPriceCalc * unitpriceQty), // CASE WHEN {custbody_manual_unit_price} is not NULL THEN ({custbody_manual_unit_price} * {custbody_ddc_unit_price_quantity}) ELSE ({custbody_ddc_unit_price_calc} * {custbody_ddc_unit_price_quantity}) END
        //     // Revenue
        //     custbody_ddc_q_outwork_ext_total: 0,
        //     custbody_ddc_q_outwork_digital_total: 0,
        //     custbody_ddc_q_outwork_group_total: 0,
        //     custbody_ddc_q_processing_total: 0,
        //     custbody_ddc_q_postage_total: 0,
        //     custbody_ddc_quote_total: 0,
        //     // Cost
        //     custbody_ddc_q_outwork_ext_total_cost: 0,
        //     custbody_ddc_q_outwork_digi_total_cost: 0,
        //     custbody_ddc_q_outwork_grp_total_cost: 0,
        //     custbody_ddc_q_processing_total_cost: 0,
        //     custbody_ddc_q_postage_total_cost: 0,
        //     custbody_ddc_quote_direct_cost_total: 0,
        //     custbody_ddc_quote_oh_cost_total: 0,
        //     custbody_ddc_quote_total_cost: 0,
        //     // Margin
        //     custbody_ddc_q_outwork_ext_margin: 0,
        //     custbody_ddc_q_outwork_digital_margin: 0,
        //     custbody_ddc_q_outwork_group_margin: 0,
        //     custbody_ddc_q_processing_margin: 0,
        //     custbody_ddc_q_postage_margin: 0,
        //     custbody_ddc_quote_total_margin: 0,
        //     custbody_ddc_quote_total_margin_approv: 0,
        // }

        // for (let i = 0; i < lineCount; i++) {
        //     let margin_category = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin_category', line: i })
        //     let amount = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
        //     let total_cost = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_total_cost', line: i }))
        //     let category_percent = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin_category_percent', line: i }))

        //     log.debug(`Line ${i}`, { margin_category, amount, total_cost, category_percent })

        //     switch (margin_category) {
        //         case '2'://'Outwork - External':
        //             vars.custbody_ddc_q_outwork_ext_total += amount
        //             vars.custbody_ddc_q_outwork_ext_total_cost += total_cost
        //             // vars.custbody_ddc_q_outwork_ext_margin += category_percent
        //             break
        //         case '4'://'Outwork - Digital':
        //             vars.custbody_ddc_q_outwork_digital_total += amount
        //             vars.custbody_ddc_q_outwork_digi_total_cost += total_cost
        //             // vars.custbody_ddc_q_outwork_digital_margin += category_percent
        //             break
        //         case '5'://'Outwork - Group':
        //             vars.custbody_ddc_q_outwork_group_total += amount
        //             vars.custbody_ddc_q_outwork_grp_total_cost += total_cost
        //             // vars.custbody_ddc_q_outwork_group_margin += category_percent
        //             break
        //         case '1'://'Processing':
        //             vars.custbody_ddc_q_processing_total += amount
        //             vars.custbody_ddc_q_processing_total_cost += total_cost
        //             // vars.custbody_ddc_q_processing_margin += category_percent
        //             break
        //         case '3'://'Postage':
        //             vars.custbody_ddc_q_postage_total += amount
        //             vars.custbody_ddc_q_postage_total_cost += total_cost
        //             // vars.custbody_ddc_q_postage_margin += category_percent
        //             break
        //     }

        //     vars.custbody_ddc_quote_direct_cost_total += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_direct_cost', line: i }))
        //     vars.custbody_ddc_quote_oh_cost_total += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_oh_cost', line: i }))
        // }
        // // 
        // /* vars.custbody_ddc_quote_total = 
        //     vars.custbody_ddc_q_outwork_ext_total + 
        //     vars.custbody_ddc_q_outwork_digital_total + 
        //     vars.custbody_ddc_q_outwork_group_total + 
        //     vars.custbody_ddc_q_processing_total + 
        //     vars.custbody_ddc_q_postage_total */
        // vars.custbody_ddc_quote_total = total - taxtotal
        // //vars.custbody_ddc_q_processing_total = vars.custbody_ddc_quote_total - vars.custbody_ddc_q_postage_total
        // if(parseFloatOrZero(vars.custbody_ddc_q_outwork_ext_total)==0){
        //     vars.custbody_ddc_q_outwork_ext_margin = 0

        // }
        // else{
        //     vars.custbody_ddc_q_outwork_ext_margin = (((vars.custbody_ddc_q_outwork_ext_total - vars.custbody_ddc_q_outwork_ext_total_cost) / vars.custbody_ddc_q_outwork_ext_total) * 100)

        // }
        // if(parseFloatOrZero(vars.custbody_ddc_q_outwork_digital_total)==0){
        //     vars.custbody_ddc_q_outwork_digital_margin =0
        // }
        // else{
        //     vars.custbody_ddc_q_outwork_digital_margin = (((vars.custbody_ddc_q_outwork_digital_total - vars.custbody_ddc_q_outwork_digi_total_cost) / vars.custbody_ddc_q_outwork_digital_total) * 100)

        // }
        // if(parseFloatOrZero( vars.custbody_ddc_q_outwork_group_total)==0){
        //     vars.custbody_ddc_q_outwork_group_margin =0
        // }   
        // else{
        //     vars.custbody_ddc_q_outwork_group_margin = (((vars.custbody_ddc_q_outwork_group_total - vars.custbody_ddc_q_outwork_grp_total_cost) / vars.custbody_ddc_q_outwork_group_total) * 100)

        // }
        // if(parseFloatOrZero(vars.custbody_ddc_q_processing_total)==0){
        //     vars.custbody_ddc_q_processing_margin =0
        // }
        // else{
        //     vars.custbody_ddc_q_processing_margin = (((vars.custbody_ddc_q_processing_total - vars.custbody_ddc_q_processing_total_cost) / vars.custbody_ddc_q_processing_total) * 100)

        // }
        // if(parseFloatOrZero(vars.custbody_ddc_q_postage_total)==0){
        //     vars.custbody_ddc_q_postage_margin =0

        // }
        // else{
        //     vars.custbody_ddc_q_postage_margin = (((vars.custbody_ddc_q_postage_total - vars.custbody_ddc_q_postage_total_cost) / vars.custbody_ddc_q_postage_total) * 100)
        // }
        // vars.custbody_ddc_quote_total_cost = vars.custbody_ddc_q_outwork_ext_total_cost + vars.custbody_ddc_q_outwork_digi_total_cost + vars.custbody_ddc_q_outwork_grp_total_cost + vars.custbody_ddc_q_processing_total_cost + vars.custbody_ddc_q_postage_total_cost
        // // vars.custbody_ddc_quote_total_margin        = vars.custbody_ddc_q_outwork_ext_margin + vars.custbody_ddc_q_outwork_digital_margin + vars.custbody_ddc_q_outwork_group_margin + vars.custbody_ddc_q_processing_margin + vars.custbody_ddc_q_postage_margin

        // if(parseFloatOrZero(vars.custbody_ddc_quote_total)==0){
        //     vars.custbody_ddc_quote_total_margin =0
        //     vars.custbody_ddc_quote_total_margin_approv = 0
        // }
        // else{
        //     vars.custbody_ddc_quote_total_margin = (((vars.custbody_ddc_quote_total - vars.custbody_ddc_quote_total_cost) / vars.custbody_ddc_quote_total) * 100)

        //     // GR - 2023-11-20 - Adding Calc for extra field used for Approval Worflow - Contains Digital and Processing data only.
        //     var approvalTotal = vars.custbody_ddc_q_outwork_digital_total + vars.custbody_ddc_q_processing_total;
        //     var approvalTotalCost = vars.custbody_ddc_q_outwork_digi_total_cost + vars.custbody_ddc_q_processing_total_cost;
        // log.debug('>>>> GR Adding approvalTotal, approvalTotalCost', approvalTotal + ', ' + approvalTotalCost)
        //     if(parseFloatOrZero(approvalTotal)==0) {
        //         vars.custbody_ddc_quote_total_margin_approv =0
        //     }
        //     else{
        //         vars.custbody_ddc_quote_total_margin_approv = (((approvalTotal - approvalTotalCost) / approvalTotal) * 100)
        //     }
        //     // GR End

        // }

        // log.debug('>>>>', { type, id, vars })

        // for (fieldId in vars)
        //     newRecord.setValue({ fieldId, value: vars[fieldId] || 0 })

      } catch (e) {
        log.debug('Error beforeSubmit QUOTE', e.message)
      }
      log.debug('------ [END] ------', 'QUOTE')
    }

    trigger.salesorder = context => {

      //#region 📜 Estimate, Sales Order | Skip Locked Record
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(context.newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
        let custbody_ddc_job_locked = context.newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          return;
        }
      }
      //#endregion

      log.debug('------ [START] ------1', 'JOB')
      try {
        let rec = context.newRecord
        let lineCount = rec.getLineCount({ sublistId: 'item' })
        let createdFrom = rec.getValue({ fieldId: 'createdfrom' })

        if (createdFrom) {
          let quote = record.load({ type: 'estimate', id: createdFrom })
          let quote_lineCount = quote.getLineCount({ sublistId: 'item' })

          let quoteXJobId = {
            'custbody_ddc_q_outwork_ext_total': 'custbody_ddc_j_outwork_ext_total',
            'custbody_ddc_q_outwork_digital_total': 'custbody_ddc_j_outwork_digital_total',
            'custbody_ddc_q_outwork_group_total': 'custbody_ddc_j_outwork_group_total',
            'custbody_ddc_q_processing_total': 'custbody_ddc_j_processing_total',
            'custbody_ddc_q_postage_total': 'custbody_ddc_j_postage_total',
            'custbody_ddc_quote_total': 'custbody_ddc_job_total',
            'custbody_ddc_q_outwork_ext_total_cost': 'custbody_ddc_j_outwork_ext_total_cost',
            'custbody_ddc_q_outwork_digi_total_cost': 'custbody_ddc_j_outwork_digi_total_cost',
            'custbody_ddc_q_outwork_grp_total_cost': 'custbody_ddc_j_outwork_grp_total_cost',
            'custbody_ddc_q_processing_total_cost': 'custbody_ddc_j_processing_total_cost',
            'custbody_ddc_q_postage_total_cost': 'custbody_ddc_j_postage_total_cost',
            'custbody_ddc_quote_direct_cost_total': 'custbody_ddc_job_direct_cost_total',
            'custbody_ddc_quote_oh_cost_total': 'custbody_ddc_job_oh_cost_total',
            'custbody_ddc_quote_total_cost': 'custbody_ddc_job_total_cost',
            'custbody_ddc_q_outwork_ext_margin': 'custbody_ddc_j_outwork_ext_margin',
            'custbody_ddc_q_outwork_digital_margin': 'custbody_ddc_j_outwork_digital_margin',
            'custbody_ddc_q_outwork_group_margin': 'custbody_ddc_j_outwork_group_margin',
            'custbody_ddc_q_processing_margin': 'custbody_ddc_j_processing_margin',
            'custbody_ddc_q_postage_margin': 'custbody_ddc_j_postage_margin',
            'custbody_ddc_quote_total_margin': 'custbody_ddc_job_total_margin',
          }
          //lay value quote set value of job.
          let quoteFieldValues = {}
          Object.keys(quoteXJobId).forEach(fieldId => {
            quoteFieldValues[fieldId] = parseFloatOrZero(quote.getValue({ fieldId }))
            //set value to job .
            rec.setValue({ fieldId: quoteXJobId[fieldId], value: quoteFieldValues[fieldId] })
          })
          log.debug('quoteFieldValues', quoteFieldValues)

          // FORMULAS
          let quoteTotalQty = 0, jobTotalQty = 0,
            actualLabourHrsTotal = 0, plannedLabourHrsTotal = 0,
            actualmachineHrsTotal = 0, plannedMachineHrsTotal = 0,
            actualmachineTPTotal = 0, plannedMachineTPTotal = 0,
            quoteTotalAmt = 0, jobTotalAmt = 0

          for (let i = 0; i < quote_lineCount; i++) {
            quoteTotalQty += parseFloatOrZero(quote.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
            quoteTotalAmt += parseFloatOrZero(quote.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
          }

          for (let i = 0; i < lineCount; i++) {
            jobTotalQty += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
            actualLabourHrsTotal += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_labour_hr_total', line: i }))
            plannedLabourHrsTotal += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_labour_hr', line: i }))
            actualmachineHrsTotal += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', line: i }))
            plannedMachineHrsTotal += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_hr', line: i }))
            actualmachineTPTotal += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_throughput', line: i }))
            plannedMachineTPTotal += parseFloatOrZero(rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_tp', line: i }))
            jobTotalAmt += parseFloatOrZero(quote.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
          }

          log.debug('FORMULAS', { quoteTotalQty, jobTotalQty, actualLabourHrsTotal, actualmachineHrsTotal, actualmachineTPTotal, quoteTotalAmt, plannedLabourHrsTotal, plannedMachineHrsTotal, plannedMachineTPTotal, jobTotalAmt })

          rec.setValue({ fieldId: 'custbody_ddc_quantity_variance', value: jobTotalQty - quoteTotalQty })
          rec.setValue({ fieldId: 'custbody_dcc_labour_hr_variance', value: actualLabourHrsTotal - plannedLabourHrsTotal })
          rec.setValue({ fieldId: 'custbody_ddc_machine_hr_variance', value: actualmachineHrsTotal - plannedMachineHrsTotal })
          rec.setValue({ fieldId: 'custbody_ddc_machine_tp_variance', value: actualmachineTPTotal - plannedMachineTPTotal })
          rec.setValue({ fieldId: 'custbody_ddc_total_variance', value: jobTotalAmt - quoteTotalAmt })

        }
      } catch (e) {
        log.debug('Error beforeSubmit JOB', e.message)
      }
      log.debug('------ [END] ------', 'JOB')
    }
    trigger.salesorder = context => {

      //#region 📜 Estimate, Sales Order | Skip Locked Record
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(context.newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
        let custbody_ddc_job_locked = context.newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          return;
        }
      }
      //#endregion

      log.debug('------ [START] ------2', 'JOB')
      try {
        let { oldRecord, newRecord } = context
        let { type, id } = newRecord
        let subsidiary = newRecord.getValue('subsidiary');
        if (subsidiary != 2) {
          return;
        }
        let lineCount = newRecord.getLineCount({ sublistId: 'item' })
        let createdFrom = newRecord.getValue({ fieldId: 'createdfrom' })

        // Commenting out temporarily to see if they can get by using manual field setting and same layout that already exists.
        //GR 30-04-2024 - Adding changing of Quote Output value from Unit Price to a new default for Job and Invoice.
        //let quoteOutput = newRecord.getValue({ fieldId: 'custbody_ddc_quote_output' })
        ////log.debug('Quote Output value before change', quoteOutput);
        //if (quoteOutput == 3) { // 3 = Unit Price
        //  newRecord.setValue({ fieldId: 'custbody_ddc_quote_output', value: 1 }) // 1 = Summary
        //}
        //GR End



        let quoteTotalQty = 0, jobTotalQty = 0,
          actualLabourHrsTotal = 0, plannedLabourHrsTotal = 0,
          actualmachineHrsTotal = 0, plannedMachineHrsTotal = 0,
          actualmachineTPTotal = 0, plannedMachineTPTotal = 0,
          quoteTotalAmt = 0, jobTotalAmt = 0
        if (createdFrom) {
          let quote = record.load({ type: 'estimate', id: createdFrom })
          let quote_lineCount = quote.getLineCount({ sublistId: 'item' })

          for (let i = 0; i < quote_lineCount; i++) {
            quoteTotalQty += parseFloatOrZero(quote.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
            quoteTotalAmt += parseFloatOrZero(quote.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
          }

        }
        for (let i = 0; i < lineCount; i++) {
          jobTotalQty += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
          actualLabourHrsTotal += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_labour_hr_total', line: i }))
          plannedLabourHrsTotal += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_labour_hr', line: i }))
          actualmachineHrsTotal += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_hr_total', line: i }))
          plannedMachineHrsTotal += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_hr', line: i }))
          actualmachineTPTotal += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_machine_throughput', line: i }))
          plannedMachineTPTotal += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine_tp', line: i }))
          jobTotalAmt += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
        }
        let total = parseFloatOrZero(newRecord.getValue({ fieldId: 'total' }))
        let taxtotal = parseFloatOrZero(newRecord.getValue({ fieldId: 'taxtotal' }))
        let subtotal = parseFloatOrZero(newRecord.getValue({ fieldId: 'subtotal' }))
        let unitpriceQty = parseFloatOrZero(newRecord.getValue({ fieldId: 'custbody_ddc_unit_price_quantity' }))
        let unitPriceManual = parseFloatOrZero(newRecord.getValue({ fieldId: 'custbody_manual_unit_price' }))
        let unitPriceCalc = unitpriceQty ? ((total - taxtotal) / unitpriceQty) : 0

        let vars = {
          custbody_ddc_unit_price_calc: unitPriceCalc,
          custbody_ddc_unit_price_amount: (unitPriceManual) ? (unitPriceManual * unitpriceQty) : (unitPriceCalc * unitpriceQty), // CASE WHEN {custbody_manual_unit_price} is not NULL THEN ({custbody_manual_unit_price} * {custbody_ddc_unit_price_quantity}) ELSE ({custbody_ddc_unit_price_calc} * {custbody_ddc_unit_price_quantity}) END
          // Revenue
          custbody_ddc_j_outwork_ext_total: 0,
          custbody_ddc_j_outwork_digital_total: 0,
          custbody_ddc_j_outwork_group_total: 0,
          custbody_ddc_j_processing_total: 0,
          custbody_ddc_j_postage_total: 0,
          custbody_ddc_job_total: 0,
          // Cost
          custbody_ddc_j_outwork_ext_total_cost: 0,
          custbody_ddc_j_outwork_digi_total_cost: 0,
          custbody_ddc_j_outwork_grp_total_cost: 0,
          custbody_ddc_j_processing_total_cost: 0,
          custbody_ddc_j_postage_total_cost: 0,
          custbody_ddc_job_direct_cost_total: 0,
          custbody_ddc_job_oh_cost_total: 0,
          custbody_ddc_job_total_cost: 0,
          // Margin
          custbody_ddc_j_outwork_ext_margin: 0,
          custbody_ddc_j_outwork_digital_margin: 0,
          custbody_ddc_j_outwork_group_margin: 0,
          custbody_ddc_j_processing_margin: 0,
          custbody_ddc_j_postage_margin: 0,
          custbody_ddc_job_total_margin: 0,
        }

        for (let i = 0; i < lineCount; i++) {
          let margin_category = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin_category', line: i })
          var amount = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
          let total_cost = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_total_cost', line: i }))
          let category_percent = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin_category_percent', line: i }))

          log.debug(`Line ${i}`, { margin_category, amount, total_cost, category_percent })

          switch (margin_category) {
            case '2'://'Outwork - External':
              vars.custbody_ddc_j_outwork_ext_total += amount
              vars.custbody_ddc_j_outwork_ext_total_cost += total_cost
              // vars.custbody_ddc_q_outwork_ext_margin += category_percent
              break
            case '4'://'Outwork - Digital':
              vars.custbody_ddc_j_outwork_digital_total += amount
              vars.custbody_ddc_j_outwork_digi_total_cost += total_cost
              // vars.custbody_ddc_q_outwork_digital_margin += category_percent
              break
            case '5'://'Outwork - Group':
              vars.custbody_ddc_j_outwork_group_total += amount
              vars.custbody_ddc_j_outwork_grp_total_cost += total_cost
              // vars.custbody_ddc_q_outwork_group_margin += category_percent
              break
            case '1'://'Processing':
              log.debug(`line ${i}`, amount)
              vars.custbody_ddc_j_processing_total += amount
              vars.custbody_ddc_j_processing_total_cost += total_cost
              // vars.custbody_ddc_q_processing_margin += category_percent
              break
            case '3'://'Postage':

              //var itemId = jobRecord.getSublistValue({
              var itemId = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
              })
              // if (itemId == 16637 || itemId == 16638 || itemId == 16639) {
              vars.custbody_ddc_j_postage_total += amount
              vars.custbody_ddc_j_postage_total_cost += total_cost
              // vars.custbody_ddc_q_postage_margin += category_percent                         
              // }
              break
          }

          vars.custbody_ddc_job_direct_cost_total += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_direct_cost', line: i }))
          vars.custbody_ddc_job_oh_cost_total += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_oh_cost', line: i }))
        }
        log.debug('test >>>>', { type, id, vars })
        // 
        /* vars.custbody_ddc_quote_total = 
            vars.custbody_ddc_q_outwork_ext_total + 
            vars.custbody_ddc_q_outwork_digital_total + 
            vars.custbody_ddc_q_outwork_group_total + 
            vars.custbody_ddc_q_processing_total + 
            vars.custbody_ddc_q_postage_total */
        vars.custbody_ddc_job_total = total - taxtotal
        log.emergency({
          title: 'vars.custbody_ddc_job_total',
          details: vars.custbody_ddc_job_total
        })
        //vars.custbody_ddc_j_processing_total = parseFloatOrZero(vars.custbody_ddc_job_total) - parseFloatOrZero(vars.custbody_ddc_j_postage_total)
        if (parseFloatOrZero(vars.custbody_ddc_j_outwork_ext_total) == 0) {
          vars.custbody_ddc_j_outwork_ext_margin = 0
        }
        else {
          vars.custbody_ddc_j_outwork_ext_margin = (((parseFloatOrZero(vars.custbody_ddc_j_outwork_ext_total) - parseFloatOrZero(vars.custbody_ddc_j_outwork_ext_total_cost)) / parseFloatOrZero(vars.custbody_ddc_j_outwork_ext_total)) * 100)

        }
        if (parseFloatOrZero(vars.custbody_ddc_j_outwork_digital_total) == 0) {
          vars.custbody_ddc_j_outwork_digital_margin = 0
        }
        else {
          vars.custbody_ddc_j_outwork_digital_margin = (((parseFloatOrZero(vars.custbody_ddc_j_outwork_digital_total) - parseFloatOrZero(vars.custbody_ddc_j_outwork_digi_total_cost)) / parseFloatOrZero(vars.custbody_ddc_j_outwork_digital_total)) * 100)

        }
        if (parseFloatOrZero(vars.custbody_ddc_j_outwork_group_total) == 0) {
          vars.custbody_ddc_j_outwork_group_margin = 0
        }
        else {
          vars.custbody_ddc_j_outwork_group_margin = (((parseFloatOrZero(vars.custbody_ddc_j_outwork_group_total) - parseFloatOrZero(vars.custbody_ddc_j_outwork_grp_total_cost)) / parseFloatOrZero(vars.custbody_ddc_j_outwork_group_total)) * 100)

        }
        if (parseFloatOrZero(vars.custbody_ddc_j_processing_total) == 0) {
          vars.custbody_ddc_j_processing_margin = 0
        }
        else {
          vars.custbody_ddc_j_processing_margin = (((parseFloatOrZero(vars.custbody_ddc_j_processing_total) - parseFloatOrZero(vars.custbody_ddc_j_processing_total_cost)) / parseFloatOrZero(vars.custbody_ddc_j_processing_total)) * 100)

        }
        if (parseFloatOrZero(vars.custbody_ddc_j_postage_total) == 0) {
          vars.custbody_ddc_j_postage_margin = 0
        }
        else {
          vars.custbody_ddc_j_postage_margin = (((parseFloatOrZero(vars.custbody_ddc_j_postage_total) - parseFloatOrZero(vars.custbody_ddc_j_postage_total_cost)) / parseFloatOrZero(vars.custbody_ddc_j_postage_total)) * 100)

        }

        vars.custbody_ddc_job_total_cost = parseFloatOrZero(vars.custbody_ddc_j_outwork_ext_total_cost) + parseFloatOrZero(vars.custbody_ddc_j_outwork_digi_total_cost) + parseFloatOrZero(vars.custbody_ddc_j_outwork_grp_total_cost) + parseFloatOrZero(vars.custbody_ddc_j_processing_total_cost) + parseFloatOrZero(vars.custbody_ddc_j_postage_total_cost)
        // vars.custbody_ddc_quote_total_margin        = vars.custbody_ddc_q_outwork_ext_margin + vars.custbody_ddc_q_outwork_digital_margin + vars.custbody_ddc_q_outwork_group_margin + vars.custbody_ddc_q_processing_margin + vars.custbody_ddc_q_postage_margin
        if (parseFloatOrZero(vars.custbody_ddc_job_total) == 0) {
          vars.custbody_ddc_job_total_margin = 0
        }
        else {
          vars.custbody_ddc_job_total_margin = (((vars.custbody_ddc_job_total - vars.custbody_ddc_job_total_cost) / vars.custbody_ddc_job_total) * 100)

        }

        log.debug('>>>>', { type, id, vars })
        newRecord.setValue({ fieldId: 'custbody_ddc_quantity_variance', value: jobTotalQty - quoteTotalQty })
        newRecord.setValue({ fieldId: 'custbody_dcc_labour_hr_variance', value: actualLabourHrsTotal - plannedLabourHrsTotal })
        newRecord.setValue({ fieldId: 'custbody_ddc_machine_hr_variance', value: actualmachineHrsTotal - plannedMachineHrsTotal })
        newRecord.setValue({ fieldId: 'custbody_ddc_machine_tp_variance', value: actualmachineTPTotal - plannedMachineTPTotal })
        newRecord.setValue({ fieldId: 'custbody_ddc_total_variance', value: jobTotalAmt - quoteTotalAmt })
        for (fieldId in vars)
          newRecord.setValue({ fieldId, value: vars[fieldId] || 0 })


      } catch (e) {
        log.debug('Error beforeSubmit JOB', e.message)
      }
      log.debug('------ [END] ------', 'JOB')
    }
    const parseFloatOrZero = n => parseFloat(n) || 0
    function afterSubmit(context) {

      //#region 📜 Estimate, Sales Order | Skip Locked Record
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(context.newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
        let custbody_ddc_job_locked = context.newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          return;
        }
      }
      //#endregion

      var newRec = context.newRecord;
      var oldRec = context.oldRecord;

      var newRecId = newRec.id;
      var newRecType = newRec.type;
      log.debug('------ [START] ------', 'QUOTE')
      if (newRec.type == 'estimate') {
        try {
          var newRecord = record.load({ type: 'estimate', id: newRecId });
          let subsidiary = newRecord.getValue('subsidiary');
          if (subsidiary != 2) {
            return;
          }
          let lineCount = newRecord.getLineCount({ sublistId: 'item' })
          let total = parseFloatOrZero(newRecord.getValue({ fieldId: 'total' }))
          let taxtotal = parseFloatOrZero(newRecord.getValue({ fieldId: 'taxtotal' }))
          let subtotal = parseFloatOrZero(newRecord.getValue({ fieldId: 'subtotal' }))
          let unitpriceQty = parseFloatOrZero(newRecord.getValue({ fieldId: 'custbody_ddc_unit_price_quantity' }))
          let unitPriceManual = parseFloatOrZero(newRecord.getValue({ fieldId: 'custbody_manual_unit_price' }))
          let unitPriceCalc = unitpriceQty ? ((total - taxtotal) / unitpriceQty) : 0

          let vars = {
            custbody_ddc_unit_price_calc: unitPriceCalc,
            custbody_ddc_unit_price_amount: (unitPriceManual) ? (unitPriceManual * unitpriceQty) : (unitPriceCalc * unitpriceQty), // CASE WHEN {custbody_manual_unit_price} is not NULL THEN ({custbody_manual_unit_price} * {custbody_ddc_unit_price_quantity}) ELSE ({custbody_ddc_unit_price_calc} * {custbody_ddc_unit_price_quantity}) END
            // Revenue
            custbody_ddc_q_outwork_ext_total: 0,
            custbody_ddc_q_outwork_digital_total: 0,
            custbody_ddc_q_outwork_group_total: 0,
            custbody_ddc_q_processing_total: 0,
            custbody_ddc_q_postage_total: 0,
            custbody_ddc_quote_total: 0,
            // Cost
            custbody_ddc_q_outwork_ext_total_cost: 0,
            custbody_ddc_q_outwork_digi_total_cost: 0,
            custbody_ddc_q_outwork_grp_total_cost: 0,
            custbody_ddc_q_processing_total_cost: 0,
            custbody_ddc_q_postage_total_cost: 0,
            custbody_ddc_quote_direct_cost_total: 0,
            custbody_ddc_quote_oh_cost_total: 0,
            custbody_ddc_quote_total_cost: 0,
            // Margin
            custbody_ddc_q_outwork_ext_margin: 0,
            custbody_ddc_q_outwork_digital_margin: 0,
            custbody_ddc_q_outwork_group_margin: 0,
            custbody_ddc_q_processing_margin: 0,
            custbody_ddc_q_postage_margin: 0,
            custbody_ddc_quote_total_margin: 0,
            custbody_ddc_quote_total_margin_approv: 0,
            custbody_ddc_q_tax_total: 0 // GR Added 2024-01-24 - Adding capture of Quote GST to be used in Job PDF
          }

          for (let i = 0; i < lineCount; i++) {
            let margin_category = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin_category', line: i })
            let amount = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
            let total_cost = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_total_cost', line: i }))
            let category_percent = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin_category_percent', line: i }))

            log.debug(`Line ${i}`, { margin_category, amount, total_cost, category_percent })

            switch (margin_category) {
              case '2'://'Outwork - External':
                vars.custbody_ddc_q_outwork_ext_total += amount
                vars.custbody_ddc_q_outwork_ext_total_cost += total_cost
                // vars.custbody_ddc_q_outwork_ext_margin += category_percent
                break
              case '4'://'Outwork - Digital':
                vars.custbody_ddc_q_outwork_digital_total += amount
                vars.custbody_ddc_q_outwork_digi_total_cost += total_cost
                // vars.custbody_ddc_q_outwork_digital_margin += category_percent
                break
              case '5'://'Outwork - Group':
                vars.custbody_ddc_q_outwork_group_total += amount
                vars.custbody_ddc_q_outwork_grp_total_cost += total_cost
                // vars.custbody_ddc_q_outwork_group_margin += category_percent
                break
              case '1'://'Processing':
                vars.custbody_ddc_q_processing_total += amount
                vars.custbody_ddc_q_processing_total_cost += total_cost
                // vars.custbody_ddc_q_processing_margin += category_percent
                break
              case '3'://'Postage':
                vars.custbody_ddc_q_postage_total += amount
                vars.custbody_ddc_q_postage_total_cost += total_cost
                // vars.custbody_ddc_q_postage_margin += category_percent
                break
            }

            vars.custbody_ddc_quote_direct_cost_total += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_direct_cost', line: i }))
            vars.custbody_ddc_quote_oh_cost_total += parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_oh_cost', line: i }))
          }
          // 
          /* vars.custbody_ddc_quote_total = 
              vars.custbody_ddc_q_outwork_ext_total + 
              vars.custbody_ddc_q_outwork_digital_total + 
              vars.custbody_ddc_q_outwork_group_total + 
              vars.custbody_ddc_q_processing_total + 
              vars.custbody_ddc_q_postage_total */
          vars.custbody_ddc_quote_total = total - taxtotal;
          vars.custbody_ddc_q_tax_total = taxtotal;  // GR Added 2024-01-24 - Adding capture of Quote GST to be used in Job PDF
          //vars.custbody_ddc_q_processing_total = vars.custbody_ddc_quote_total - vars.custbody_ddc_q_postage_total
          if (parseFloatOrZero(vars.custbody_ddc_q_outwork_ext_total) == 0) {
            vars.custbody_ddc_q_outwork_ext_margin = 0

          }
          else {
            vars.custbody_ddc_q_outwork_ext_margin = (((vars.custbody_ddc_q_outwork_ext_total - vars.custbody_ddc_q_outwork_ext_total_cost) / vars.custbody_ddc_q_outwork_ext_total) * 100)

          }
          if (parseFloatOrZero(vars.custbody_ddc_q_outwork_digital_total) == 0) {
            vars.custbody_ddc_q_outwork_digital_margin = 0
          }
          else {
            vars.custbody_ddc_q_outwork_digital_margin = (((vars.custbody_ddc_q_outwork_digital_total - vars.custbody_ddc_q_outwork_digi_total_cost) / vars.custbody_ddc_q_outwork_digital_total) * 100)

          }
          if (parseFloatOrZero(vars.custbody_ddc_q_outwork_group_total) == 0) {
            vars.custbody_ddc_q_outwork_group_margin = 0
          }
          else {
            vars.custbody_ddc_q_outwork_group_margin = (((vars.custbody_ddc_q_outwork_group_total - vars.custbody_ddc_q_outwork_grp_total_cost) / vars.custbody_ddc_q_outwork_group_total) * 100)

          }
          if (parseFloatOrZero(vars.custbody_ddc_q_processing_total) == 0) {
            vars.custbody_ddc_q_processing_margin = 0
          }
          else {
            vars.custbody_ddc_q_processing_margin = (((vars.custbody_ddc_q_processing_total - vars.custbody_ddc_q_processing_total_cost) / vars.custbody_ddc_q_processing_total) * 100)

          }
          if (parseFloatOrZero(vars.custbody_ddc_q_postage_total) == 0) {
            vars.custbody_ddc_q_postage_margin = 0

          }
          else {
            vars.custbody_ddc_q_postage_margin = (((vars.custbody_ddc_q_postage_total - vars.custbody_ddc_q_postage_total_cost) / vars.custbody_ddc_q_postage_total) * 100)
          }
          vars.custbody_ddc_quote_total_cost = vars.custbody_ddc_q_outwork_ext_total_cost + vars.custbody_ddc_q_outwork_digi_total_cost + vars.custbody_ddc_q_outwork_grp_total_cost + vars.custbody_ddc_q_processing_total_cost + vars.custbody_ddc_q_postage_total_cost
          // vars.custbody_ddc_quote_total_margin        = vars.custbody_ddc_q_outwork_ext_margin + vars.custbody_ddc_q_outwork_digital_margin + vars.custbody_ddc_q_outwork_group_margin + vars.custbody_ddc_q_processing_margin + vars.custbody_ddc_q_postage_margin

          if (parseFloatOrZero(vars.custbody_ddc_quote_total) == 0) {
            vars.custbody_ddc_quote_total_margin = 0
            vars.custbody_ddc_quote_total_margin_approv = 0
          }
          else {
            vars.custbody_ddc_quote_total_margin = (((vars.custbody_ddc_quote_total - vars.custbody_ddc_quote_total_cost) / vars.custbody_ddc_quote_total) * 100)

            // GR - 2023-11-20 - Adding Calc for extra field used for Approval Worflow - Contains Digital and Processing data only.
            //var approvalTotal = vars.custbody_ddc_q_outwork_digital_total + vars.custbody_ddc_q_processing_total;
            //var approvalTotalCost = vars.custbody_ddc_q_outwork_digi_total_cost + vars.custbody_ddc_q_processing_total_cost;

            // GR - 2024-05-09 - Adding change for calc of Approval Workflow - Contains Processing + Outwork Group + Outwork External +Outwork Digital
            var approvalTotal = vars.custbody_ddc_q_outwork_ext_total + vars.custbody_ddc_q_outwork_digital_total + vars.custbody_ddc_q_outwork_group_total + vars.custbody_ddc_q_processing_total;
            var approvalTotalCost = vars.custbody_ddc_q_outwork_ext_total_cost + vars.custbody_ddc_q_outwork_digi_total_cost + vars.custbody_ddc_q_outwork_grp_total_cost + vars.custbody_ddc_q_processing_total_cost;


            log.debug('>>>> GR Adding approvalTotal, approvalTotalCost', approvalTotal + ', ' + approvalTotalCost)
            if (parseFloatOrZero(approvalTotal) == 0) {
              vars.custbody_ddc_quote_total_margin_approv = 0
            }
            else {
              vars.custbody_ddc_quote_total_margin_approv = (((approvalTotal - approvalTotalCost) / approvalTotal) * 100)
            }
            // GR End

          }

          // log.debug('>>>>', { type, id, vars })

          log.emergency({
            title: 'vars',
            details: vars
          })
          for (fieldId in vars)
            newRecord.setValue({ fieldId, value: vars[fieldId] || 0 })

          var recordId = newRecord.save();
          log.debug('recordId', recordId);
        } catch (e) {
          log.debug('Error beforeSubmit QUOTE', e.message)
        }
        log.debug('------ [END] ------', 'QUOTE')
      }
    }
    return { beforeSubmit, afterSubmit }

  });