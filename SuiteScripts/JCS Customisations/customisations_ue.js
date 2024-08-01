/**
* @NApiVersion 2.1
* @NScriptType UserEventScript
* @NModuleScope Public
* /

/**
* @name:                                       customisations_ue.js
* @author:                                     Phudit Ditsakul
* @summary:                                    DDC Customisations
* @copyright:                                  © Copyright by Jcurve Solutions
* Date Created:                                20/05/2024
* FRD URL:                                     
* Release Notes URL:                           
*/

/**
 * @deployedto Job
 * @deployedto Quote
 */

define(['N/record', 'N/runtime', 'N/search', 'N/ui/message', 'N/ui/serverWidget', 'N/url', 'N/xml', 'N/task', './ns.utils', './lodash.js', 'N/format', 'N/log', './run_creation_cm'],
  function (record, runtime, search, message, serverWidget, url, xml, task, ns_utils, _, format, log, cm) {

    //#region 📜 Enum
    const Enum = {
      Subsidiary: {
        DDC: '2', // IVE - Data Driven Communications
      },
      Item: {
        Description: -3,
        POSTAU: 16664,
        POSTOS: 16666,
        PMGT05: 16637,
        PMGT10: 16638,
        PMGTOT: 16639,
        Customer_Prepay_Item: 17502, // Customer Prepay Item
        Customer_Prepay_Item_Intercompany: 17503 // Customer Prepay Item - Intercompany
      },
      customlist_ddc_quantity_source: {
        Quote: 1,
        Project: 2,
        iVerify: 3,
        Manual: 4,
      },
      customlist_ive_stock_type: {
        Plastic: 9,
        Paper_Reel: 27, // Paper-Reel
      },
      customrecord_ddc_item_category: {
        Data_Processing_and_Preparation: 6, // Data Processing & Preparation
        Postage_Details: 20, // Postage Details
      },
      User: {
        SystemAccount: 4842 // System Account
      }
    };
    //#endregion

    function beforeLoad(context) {
      //#region 📜 Initiation
      const newRecord = context.newRecord;
      const form = context.form;
      let subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      //#endregion

      //#region 📜 Skip Job Locked Record from Web Services
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
        let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          return;
        }
      }
      //#endregion

      // //#region 📜 Sales Order | Prevent Trigger Scheduled Script
      // if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.CREATE, context.UserEventType.EDIT, context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
      //     let custpage_ddc_job_preventschscript = form.addField({
      //         id: 'custpage_ddc_job_preventschscript',
      //         type: serverWidget.FieldType.CHECKBOX,
      //         label: 'Prevent Trigger Scheduled Script',
      //     })//.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
      //     custpage_ddc_job_preventschscript.setHelpText({ help: "Prevent Trigger Scheduled Script\nThis field created by: Customisation UE" });
      // }
      // //#endregion

      //#region 📜 Sales Order | Create a Initial Message when the Job is Locked.
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.VIEW].includes(context.type) && runtime.executionContext == runtime.ContextType.USER_INTERFACE && subsidiary == Enum.Subsidiary.DDC) {
        let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          let scheduledScriptStatusURL = getScheduledScriptStatusPageURL({ scriptId: 'customscript_trigger_jobprcoptimised_ss' })
          form.addPageInitMessage({ type: message.Type.INFORMATION, message: 'Job updates are in progress. Please wait and refresh the page once they are complete. <a href="' + scheduledScriptStatusURL + '" target="_blank">Scheduled Script Status</a>' });
        }

        function getScheduledScriptStatusPageURL({ scriptId }) {
          let scriptSearchObj = search.create({
            type: "script",
            filters: [["scriptid", "is", scriptId]],
            columns: []
          });
          let scheduleScriptInternalId = '';
          scriptSearchObj.run().each(function (result) { scheduleScriptInternalId = result.id; return true; });
          let host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
          return 'https://' + host + '/app/common/scripting/scriptstatus.nl?daterange=CUSTOM&datefrom=&dateto=&scripttype=' + scheduleScriptInternalId + '&primarykey=&jobstatefilterselect=unfinished';
        }
      };
      //#endregion

      //#region 📜 Sales Order | Default Value | Move From DDC - Set Job Order Status and Qty (Workflow) | Quantities on the new job will be transferred to quoted qty custom field, also resets the statuses, other fields. This is to show quoted qty vs actuals on job. | 🔗 https://5281669-sb1.app.netsuite.com/app/common/workflow/setup/nextgen/workflowdesktop.nl?id=197
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.CREATE, context.UserEventType.COPY].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        // DDC - Set Job Order Status and Qty
        // Order Status
        newRecord.setValue({ fieldId: 'orderstatus', value: 'A' }); // Pending Approval
        if (context.type === context.UserEventType.COPY) {
          // Job (Main)
          newRecord.setValue({ fieldId: 'job', value: '' });
          // Runs Created
          newRecord.setValue({ fieldId: 'custbody_ddc_runs_created', value: false });
          // Runs Creation Ready
          newRecord.setValue({ fieldId: 'custbody_run_creation_ready', value: false });
        }

        // Items Sublist
        let itemResults = lookupItems({ newRecord, columns: ['type', 'custitem_ddc_actual_cost_qty_src', 'custitem_ddc_stock_type'] });
        let lineCount = newRecord.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < lineCount; i++) {
          let item = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
          let itemResult = itemResults.find(x => x.id == item) || {};
          let custcol_ddc_unit_sale = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: i }); // Unit (Line)

          // Quoted Qty (External) (Line)
          if (custcol_ddc_unit_sale) {
            let quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }); // Quantity (Line)
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_quoted_qty_external', line: i, value: quantity });
          }

          // Actual Qty (Line)
          if (custcol_ddc_unit_sale && [Enum.customlist_ddc_quantity_source.Quote, Enum.customlist_ddc_quantity_source.Manual].includes(parseInt(itemResult.custitem_ddc_actual_cost_qty_src))) {
            let quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }); // Quantity (Line)
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i, value: quantity });
          }

          // Actual Qty (Line)
          if (custcol_ddc_unit_sale && itemResult.custitem_ddc_actual_cost_qty_src != Enum.customlist_ddc_quantity_source.Quote && itemResult.type != 'InvtPart') {
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i, value: 0 });
          }

          // Quantity (Line)
          if (custcol_ddc_unit_sale && ![Enum.customlist_ddc_quantity_source.Quote, Enum.customlist_ddc_quantity_source.Project].includes(parseInt(itemResult.custitem_ddc_actual_cost_qty_src))) {
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: 0 });
          }

          // Quantity (Line)
          if (itemResult.type == 'InvtPart' && ![Enum.customlist_ive_stock_type.Plastic, Enum.customlist_ive_stock_type.Paper_Reel].includes(parseInt(itemResult.custitem_ddc_stock_type))) {
            let custcol_ddc_quoted_qty_external = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_quoted_qty_external', line: i }); // Quoted Qty (External) (Line)
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: custcol_ddc_quoted_qty_external });
          }
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeLoad | DDC - Set Job Order Status and Qty' });
      }
      //#endregion

      //#region 📜 Sales Order | Default Value | Move From DDC - Actual Qty Source - Quote (Workflow) | Sources the item record, if the actual qty source on the item record is set to quote. If yes, the workflow sets the actual qty, billable qty to what was quoted. | 🔗 https://5281669-sb1.app.netsuite.com/app/common/workflow/setup/nextgen/workflowdesktop.nl?id=412
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        // Items Sublist
        let itemResults = lookupItems({ newRecord, columns: ['type', 'custitem_ddc_actual_cost_qty_src', 'custitem_ddc_stock_type'] });
        let lineCount = newRecord.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < lineCount; i++) {
          let item = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
          let itemResult = itemResults.find(x => x.id == item) || {};
          let custcol_ddc_unit_sale = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_unit_sale', line: i }); // Unit (Line)

          // Actual Qty (Line)
          if (custcol_ddc_unit_sale && itemResult.custitem_ddc_actual_cost_qty_src == Enum.customlist_ddc_quantity_source.Quote) {
            let custcol_ddc_quoted_qty_external = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_quoted_qty_external', line: i }); // Quoted Qty (External) (Line)
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i, value: custcol_ddc_quoted_qty_external });
          }

          // Quantity (Line)
          if (custcol_ddc_unit_sale && ![Enum.customlist_ddc_quantity_source.Manual].includes(parseInt(itemResult.custitem_ddc_actual_cost_qty_src))) {
            let custcol_ddc_actual_qty = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i }); // Actual Qty (Line)
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: custcol_ddc_actual_qty });
          }
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeLoad | DDC - Actual Qty Source - Quote' });
      }
      //#endregion

      //#region 📜 Sales Order | Move From JCS Job Variation UE | Related to variation, can be isolated to run only on Variation button | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1579&e=T
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.VIEW].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let jobParent = newRecord.getValue({ fieldId: "custbody_ddc_linked_parent_job" });
        let readyForInvoiceStatus = 3;
        let invoiceStatus = 5;
        let paymentCompleteStatus = 6;
        let cancelStatus = 8;
        let statusJob = newRecord.getValue({ fieldId: "status" });
        if (!jobParent && (statusJob == 'Pending Billing' || statusJob == 'Pending Fulfillment' || statusJob == 'Partially Fulfilled' || statusJob == 'Closed' || statusJob == 'Pending Billing/Partially Fulfilled')) {
          form.addButton({
            id: "custpage_create_variation_job",
            label: 'Create Variation Job',
            functionName: 'createVariationJob(' + newRecord.id + ')'
          });
          form.clientScriptModulePath = "SuiteScripts/Jcs Run Management/create_runs_streams_cl.js";
        }

        let jobStatus = newRecord.getValue({ fieldId: "custbody_ddc_job_status" });
        let isCreateRuns = newRecord.getValue({ fieldId: "custbody_ddc_runs_created" });
        if (jobStatus == readyForInvoiceStatus || jobStatus == invoiceStatus || jobStatus == paymentCompleteStatus || jobStatus == cancelStatus) {
          // log.debug("runs status ", jobStatus);
          // return;
        } else {
          if (!isCreateRuns) {
            form.addButton({
              id: "custpage_create_run_stream",
              label: 'Create Runs/Streams',
              functionName: "popupButton_OnClick"
            });
            form.clientScriptModulePath = "SuiteScripts/Jcs Run Management/create_runs_streams_cl.js";
          } else {
            form.addButton({
              id: "custpage_create_run_stream",
              label: 'Update Runs/Streams',
              functionName: "popupButton_OnClick_Update"
            });
            form.clientScriptModulePath = "SuiteScripts/Jcs Run Management/create_runs_streams_cl.js";
          }
        }
      }
      //#endregion

      //#region 📜 Sales Order | Move From JCS Run Creation UE (Before Load Only) | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1307
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.VIEW].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        let isCreatedRun = newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });
        if (isCreatedRun) {
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
        // logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeLoad | JCS Run Creation' });
      }
      //#endregion

      //#region 📜 Sales Order | Move From JCS Placeholder Item Job Sales Order (Before Load Only) | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1575
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        const customer = newRecord.getValue({ fieldId: 'entity' });
        const subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });

        //GR - Adding this in now to stop error for Logistics Business. Jay to confirm later.
        let itemSublist = form.getSublist({ id: 'item' });
        let getPlaceHolderField = itemSublist.getField({ id: 'custcol_placeholder_replacement_item' });
        if (Object.keys(getPlaceHolderField).length > 0) {
          getPlaceHolderField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
        }

        let addPlaceHolderColumnField = itemSublist.addField({
          id: 'custpage_placeholderitem',
          type: serverWidget.FieldType.SELECT,
          label: 'Available Replacement Items'
        });
        addPlaceHolderColumnField.addSelectOption({ value: '', text: '' });
        addPlaceHolderColumnField.addSelectOption({ value: Enum.Item.Customer_Prepay_Item, text: 'Customer Prepay Item' });
        addPlaceHolderColumnField.addSelectOption({ value: Enum.Item.Customer_Prepay_Item_Intercompany, text: 'Customer Prepay Item - Intercompany' });

        const loadPlaceHolderItems = (customer, subsidiary) => {
          let array = []
          let filterArray = [];
          if (customer) {
            filterArray = [
              ["subsidiary", "anyof", subsidiary],
              "AND",
              ["type", "anyof", "InvtPart"],
              "AND",
              [["custitem_ddc_owned_by_cust", "anyof", customer], "OR", ["custitem_ddc_is_cust_owned", "is", "F"]]
            ]
          } else {
            filterArray = [
              ["subsidiary", "anyof", subsidiary],
              "AND",
              ["type", "anyof", "InvtPart"],
              "AND",
              ["custitem_ddc_is_cust_owned", "is", "F"]
            ]
          }

          let inventoryitemSearchObj = search.create({
            type: "inventoryitem",
            filters: filterArray,
            columns:
              [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "displayname", label: "Display Name" }),
                search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Name" })
              ]
          });
          inventoryitemSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            let id = result.getValue('internalid')
            let displayName = result.getValue('itemid')
            array.push({
              id: id,
              displayName: displayName
            });
            return true;
          });
          return array;
        }

        let placeHolderList = loadPlaceHolderItems(customer, subsidiary);
        if (placeHolderList.length > 0) {
          placeHolderList.forEach((item) => {
            addPlaceHolderColumnField.addSelectOption({
              value: item.id,
              text: item.displayName
            });
          });
        }
        // logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeLoad | JCS Placeholder Item Job Sales Order' });
      }
      //#endregion
    }

    function beforeSubmit(context) {
      //#region 📜 Initiation
      const newRecord = context.newRecord;
      const oldRecord = context.oldRecord;
      let subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      // log.debug('beforeSubmit | newRecord.type | context.type | runtime.executionContext', newRecord.type + ' | ' + context.type + ' | ' + runtime.executionContext);
      //#endregion

      //#region 📜 Estimate, Sales Order | Skip Locked Record
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
        let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          return;
        }
      }
      //#endregion

      //#region 📜 Sales Order | Locking scripts for iVerify
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && [runtime.ContextType.USER_INTERFACE, runtime.ContextType.SUITELET].includes(runtime.executionContext) && subsidiary == Enum.Subsidiary.DDC) {
        newRecord.setValue({ fieldId: 'custbody_ddc_job_locked', value: true });
      }
      //#endregion

      //#region 📜 Sales Order | Move From JCS Source Item Fields UE | Get Predifined fields from items and setting on the transaction columns. | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1699
      if ([record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        let itemResults = lookupItems({ newRecord, columns: ['type', 'custitem_ddc_project_task_cb'] });
        let newLineCount = newRecord.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < newLineCount; i++) {
          let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
          let itemResult = itemResults.find(x => x.id == itemId) || {};
          let actual_qty = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i });
          if (actual_qty && !itemResult.custitem_ddc_project_task_cb) {
            newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: actual_qty, line: i });
          }
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeSubmit | JCS Source Item Fields' });
      }
      //#endregion

      //#region 📜 Sales Order | Move From Data Processing Items UE | Ensures only 1 of the data processing group of items is charged, and the rest are not. | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1292
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        let cnt = 0;
        //create scenario
        //check each item of the custitem_ddc_data_processing_item is checked, then set all other data processing items total cost to 0
        let itemResults = lookupItems({ newRecord, columns: ['custitem_ddc_data_processing_item'] });
        let lineCount = newRecord.getLineCount({ sublistId: 'item' })
        for (let i = 0; i < lineCount; i++) {
          let itemCat = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_category', line: i });

          if (itemCat == Enum.customrecord_ddc_item_category.Data_Processing_and_Preparation) {
            let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
            let itemResult = itemResults.find(x => x.id == itemId) || {};
            // let dataProcessing = search.lookupFields({ type: 'item', id: itemId, columns: ['custitem_ddc_data_processing_item'] })
            // let isDataProcessing = dataProcessing.custitem_ddc_data_processing_item;

            if (itemResult.custitem_ddc_data_processing_item) {
              if (cnt > 0) {

                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_total_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hour_rate', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_rate', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hour_rate', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_other_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_hr_calc', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_labour_oh_hr_calc', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_machine_hr_calc', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_other_cost_calc', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_third_party_cost_calc', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_direct_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_oh_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_labour_hr_calc_tot', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_labour_oh_hr_calc_tot', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_machine_hr_calc_tot', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_oth_cost_calc_tot', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_act_3party_cost_calc_tot', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_direct_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_oh_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_total_cost', line: i, value: 0 });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_margin', line: i, value: 0 });

                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_from_costing', line: i, value: true });
              } else {
                // let itemAmt = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
                // newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_total_cost', line: i, value: itemAmt });
                cnt++
              }
            }
          }
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeSubmit | Data Processing Items' });
      }
      //#endregion

      //#region 📜 Quote, Sales Order | Move From JCS Manual Qty UE | Used to manage user-defined quantity as an override for auto calc process | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1311
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC &&
        (
          // Phudit: Confusion here
          (runtime.executionContext != runtime.ContextType.SUITELET)
          || (runtime.getCurrentUser().id === Enum.User.SystemAccount && runtime.executionContext === runtime.ContextType.WEBSERVICES)
          || (runtime.getCurrentUser().subsidiary === Enum.Subsidiary.DDC)
        )
      ) {
        let logObj = logStart();
        let itemResults = lookupItems({ newRecord, columns: ['type', 'custitem_ddc_project_task_cb'] });
        let lineCount = newRecord.getLineCount({ sublistId: 'item' })
        for (let i = 0; i < lineCount; i++) {
          let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
          let itemResult = itemResults.find(x => x.id == itemId) || {};
          if (itemId != Enum.Item.Description && itemId != Enum.Item.POSTAU && itemId != Enum.Item.POSTOS) {
            // let projectTaskItem = search.lookupFields({ type: search.Type.ITEM, id: itemId, columns: ['custitem_ddc_project_task_cb', 'type'] })
            if (itemResult.value != 'Description') {
              // let qty = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }))
              let actual_qty = parseFloatOrZero(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i }))
              let manual_qty = parseFloatOrZeroSec(newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_billable_qty_manual', line: i }))
              // let old_manual_qty = parseFloatOrZero(oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_billable_qty_manual', line: i }))
              log.emergency({
                title: `line ${i} | qty ${actual_qty} | manual_qty ${manual_qty}`,
                details: {
                  actual_qty,
                  manual_qty
                }
              })
              if (itemResult.custitem_ddc_project_task_cb) {
                if (manual_qty > 0) {
                  // if (old_manual_qty != manual_qty) {
                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: manual_qty })
                  // if (actual_qty)
                  //     newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: actual_qty })
                  // }
                }
              } else {
                if (manual_qty !== '' && manual_qty >= 0) {
                  // if (old_manual_qty != manual_qty) { // GR 06-02-2023 - removing this condition to allow manual_qty to be updated even if it is the same as old_manual_qty
                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: manual_qty })
                  // if (actual_qty)
                  //     newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: actual_qty })
                  // }
                } else if (manual_qty == 0 && actual_qty > 0) {
                  //GR 25-01-2023 - adding next line for Prebill Qty - field backup when updating Actual
                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_prebill_qty', line: i, value: actual_qty })
                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: actual_qty })
                }
              }
            }
          }
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeSubmit | JCS Manual Qty' });
      }
      //#endregion

      //#region 📜 Sales Order | Move From JCS Compute Postage Amount | Calculates Postage fees | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1298
      // ⚠️ Run this script after the JCS Customer Rate Card UE
      if ([record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.EDIT].includes(context.type) && runtime.executionContext != runtime.ContextType.SUITELET && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        let postageInclusive = newRecord.getValue({ fieldId: 'custbody_ddc_postage_mgt_fee_inclusive' })
        let lineCount = newRecord.getLineCount({ sublistId: 'item' })
        let postageFeeRate = newRecord.getValue({ fieldId: 'custbody_ddc_postage_mgt_fee_rate' })

        //If Postage Management Fee Inclusive ?= FALSE (unticked), update the Postage Management Fee line item “Amount” field with the new calculated amount.
        let postageItemsArr = [];
        if (!postageInclusive) {
          let totalPostageAmt = 0;

          //Logic: Add amount of all Specific Postage Service Items(Criteria: Item Category= Postage Details and Exclude from Quote PDF = TRUE) and multiply with the Postage Management Fee Rate
          for (let i = 0; i < lineCount; i++) {
            let itemCat = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_category', line: i })

            //GR Add: 2024-01-19 - Checking if the postage row is generic
            let hasStreamNumber = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i })
            let itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i })
            let quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i }) || 0
            let postageAmt = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_postage_amount', line: i })

            if (itemCat == Enum.customrecord_ddc_item_category.Postage_Details && !hasStreamNumber) {
              //only run if there is an update to the postage amount
              totalPostageAmt += parseFloatOrZero(postageAmt)
              postageItemsArr.push({
                index: i,
                itemId: itemId,
                quantity: quantity,
                postageAmt: parseFloatOrZero(postageAmt)
              })
            } else if (itemId == Enum.Item.PMGT05 || itemId == Enum.Item.PMGT10 || itemId == Enum.Item.PMGTOT) {
              postageItemsArr.push({
                index: i,
                itemId: itemId,
                quantity: quantity,
                postageAmt: parseFloatOrZero(postageAmt)
              })
            }
          }
          //Set the “Amount” field of the Specific Postage Service Item equal to “Postage Amount” field

          let computedPostageAmt = parseFloatOrZero(totalPostageAmt) * parseFloatOrZero(postageFeeRate / 100)
          for (let j = 0; j < postageItemsArr.length; j++) {
            if (postageItemsArr[j].itemId == Enum.Item.PMGT05 || postageItemsArr[j].itemId == Enum.Item.PMGT10 || postageItemsArr[j].itemId == Enum.Item.PMGTOT) {
              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: postageItemsArr[j].index, value: computedPostageAmt })
            } else {
              // log.debug({
              //     title: 'GR/LG: setting the amount on non fee lines: line,value',
              //     details: postageItemsArr[j].index + "; " + postageItemsArr[j].postageAmt
              // })
              if (postageItemsArr[j].quantity != 0) {
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: postageItemsArr[j].index, value: postageItemsArr[j].postageAmt / postageItemsArr[j].quantity })
              }
              else {
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: postageItemsArr[j].index, value: 0 })
              }
            }
          }
        } else {
          // Scenario 2: Postage Management Fee Inclusive ?= TRUE
          // For each of the Specific Postage Service line item/s multiply the “Postage Amount” field with the Postage Management Fee Rate
          // add the computed amount into their corresponding “Amount” fields

          for (let i = 0; i < lineCount; i++) {
            let itemCat = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_category', line: i })

            //GR Add: 2024-01-19 - Checking if the postage row is generic
            let hasStreamNumber = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i })

            //if (itemCat ==  Enum.customrecord_ddc_item_category.Postage_Details && excludePdf) {
            if (itemCat == Enum.customrecord_ddc_item_category.Postage_Details && !hasStreamNumber) {
              let postageAmt = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_postage_amount', line: i })
              let quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i }) || 0
              let additionalAmt = (parseFloatOrZero(postageAmt) * parseFloatOrZero(postageFeeRate / 100))
              if (quantity != 0) {
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: (parseFloatOrZero(postageAmt) + parseFloatOrZero(additionalAmt)) / quantity })
              } else {
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: 0 })
              }
            }
          }
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeSubmit | JCS Compute Postage Amount' });
      }
      //#endregion

      //#region 📜 Sales Order | Move From DDC Set Next Pick Date off Prod to Start (Workflow) | Workflow to set a pick date | 🔗 https://5281669-sb1.app.netsuite.com/app/common/workflow/setup/nextgen/workflowdesktop.nl?id=629
      if ([record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        let custbody_ddc_production_to_commence = newRecord.getValue({ fieldId: 'custbody_ddc_production_to_commence' });
        if (custbody_ddc_production_to_commence) {
          let nextPickDate = new Date(custbody_ddc_production_to_commence);
          nextPickDate.setDate(custbody_ddc_production_to_commence.getDate() - 1);
          newRecord.setValue({ fieldId: 'custbody_ddc_next_pick_date', value: nextPickDate });
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | beforeSubmit | DDC Set Next Pick Date off Prod to Start' });
      }
      //#endregion
    }

    function afterSubmit(context) {
      //#region 📜 Initiation 
      let newRecord = context.newRecord;
      const oldRecord = context.oldRecord;
      newRecord = record.load({ type: newRecord.type, id: newRecord.id });
      let subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      // log.debug('afterSubmit | newRecord.type | context.type | runtime.executionContext', newRecord.type + ' | ' + context.type + ' | ' + runtime.executionContext);
      //#endregion

      //#region 📜 Estimate, Sales Order | Skip Locked Record
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
        let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
        if (custbody_ddc_job_locked) {
          return;
        }
      }
      //#endregion

      //#region 📜 Quote, Sales Order | Move From DDC - Set Item Key for Non Configurator Rows | Set Item Key(unque ref) for NonConfig Rows, unique refs are required for iVerify | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1700
      if ([record.Type.ESTIMATE, record.Type.SALES_ORDER].includes(newRecord.type) && [context.UserEventType.CREATE, context.UserEventType.EDIT].includes(context.type) && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();

        // Check if required update.
        let emptyItemKeyCount = 0;
        let lineCount = newRecord.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < lineCount; i++) {
          let configData = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_scpq_item_col_config_data', line: i });
          if (!configData) {
            emptyItemKeyCount++;
          }
        }

        if (emptyItemKeyCount > 0) {
          let objRecord = record.load({ type: newRecord.type, id: newRecord.id, });
          let lineCount = objRecord.getLineCount({ sublistId: 'item' });
          for (let i = 0; i < lineCount; i++) {
            let configData = objRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_scpq_item_col_config_data', line: i });
            let lineUniqueKey = objRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
            if (!configData) {
              let manualItemKey = objRecord.id + '_' + lineUniqueKey;
              objRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', line: i, value: manualItemKey });
            }
          }
          objRecord.save();
        }
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | afterSubmit | DDC - Set Item Key for Non Configurator Rows' });
      }
      //#endregion

      // //#region 📜 Sales Order | Move From JCS Automation Item Fulfillment UE | Actual Qty gets updated after manufacting, script will auto-fill | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1291
      // // 17/07/2024 Moved to the DDC_Job_Process_optimised_SS.js
      // if (newRecord.type === record.Type.SALES_ORDER
      //     && (
      //         (context.type == context.UserEventType.EDIT && runtime.executionContext != runtime.ContextType.SCHEDULED) // To prevent RCRD_HAS_BEEN_CHANGED, ignore scheduled script. User will edit and save the record to trigger the script.
      //         ||
      //         (runtime.executionContext == runtime.ContextType.WEBSERVICES && runtime.getCurrentUser().id === Enum.User.SystemAccount)
      //     )
      //     && subsidiary == Enum.Subsidiary.DDC
      // ) {
      //     let logObj = logStart();
      //     try {
      //         let itemArr = [];
      //         let objRecord = record.load({ type: record.Type.SALES_ORDER, id: newRecord.id, });
      //         let status = objRecord.getText({ fieldId: 'status' });

      //         // GR - 2023-07-11 - Adding Pending Fulfillment status so this works on first IF
      //         //if (status == 'Pending Billing/Partially Fulfilled' || status == 'Pending Billing') {
      //         if (status == 'Pending Fulfillment' || status == 'Pending Billing/Partially Fulfilled' || status == 'Pending Billing' || status == 'Partially Fulfilled') {
      //             let line = objRecord.getLineCount('item');
      //             for (let i = 0; i < line; i++) {
      //                 let itemtype = objRecord.getSublistValue('item', 'itemtype', i);
      //                 if (itemtype == 'InvtPart') {
      //                     let itemId = objRecord.getSublistValue('item', 'item', i);
      //                     let itemText = objRecord.getSublistText('item', 'item', i);
      //                     let quantity = objRecord.getSublistValue('item', 'quantity', i);
      //                     let actualQuantity = objRecord.getSublistValue('item', 'custcol_ddc_actual_qty', i);
      //                     let quantityfulfilled = objRecord.getSublistValue('item', 'quantityfulfilled', i);
      //                     let preferredBin = objRecord.getSublistValue('item', 'custcol_ddc_pref_fulfillment_bin_id', i);
      //                     let alternateBin = objRecord.getSublistValue('item', 'custcol_ddc_alt_fulfillment_bin_id', i);
      //                     let lineNumber = objRecord.getSublistValue('item', 'line', i);
      //                     let units = objRecord.getSublistText('item', 'units', i);

      //                     // GR - 2023-11-08 - Adding check for whether Inventory is Weight-tracked, ie. Has Units=KG and an Actual KGs value.
      //                     let actualKgs = objRecord.getSublistValue('item', 'custcol_ddc_actual_kgs', i) || 0;
      //                     actualKgs = actualKgs.toFixed(5);
      //                     let qtyToUse;

      //                     if (units == 'KG') {
      //                         qtyToUse = actualKgs;
      //                     } else {
      //                         qtyToUse = actualQuantity;
      //                     }
      //                     if (itemtype == 'InvtPart' && (parseFloatOrZero(qtyToUse) - parseFloatOrZero(quantityfulfilled) > 0)) {
      //                         itemArr.push({
      //                             itemId: itemId,
      //                             itemText: itemText,
      //                             quantity: parseFloatOrZero(qtyToUse) - parseFloatOrZero(quantityfulfilled),
      //                             //quantity: parseFloatOrZero(quantity),
      //                             lineNumber: lineNumber,
      //                             preferredBin: preferredBin,
      //                             alternateBin: alternateBin
      //                         })
      //                     }
      //                     // GR End
      //                 }
      //             }

      //             if (itemArr.length > 0) {
      //                 let soLocation = search.lookupFields({ type: "salesorder", id: newRecord.id, columns: ['location'] }).location;
      //                 let prefBinArray = itemArr.flatMap((val) => { return val.preferredBin })
      //                 let alternateBinArray = itemArr.flatMap((val) => { return val.alternateBin })

      //                 prefBinArray = prefBinArray = [...new Set(prefBinArray)];
      //                 alternateBinArray = alternateBinArray = [...new Set(alternateBinArray)];

      //                 let binArray = [...prefBinArray, ...alternateBinArray]

      //                 const loadBinData = getBinQuantityLocationData(soLocation[0].value, binArray)

      //                 let itemFullFillRec = record.transform({
      //                     fromType: record.Type.SALES_ORDER,
      //                     fromId: parseInt(newRecord.id),
      //                     toType: record.Type.ITEM_FULFILLMENT,
      //                     isDynamic: true,
      //                     defaultValues: {
      //                         inventorylocation: soLocation[0].value
      //                     }
      //                 });

      //                 let lineCount = itemFullFillRec.getLineCount({ sublistId: 'item' });
      //                 let fulfilledLinesArray = [];
      //                 for (let k = 0; k < lineCount; k++) {
      //                     itemFullFillRec.selectLine({ sublistId: 'item', line: k });
      //                     let itemId = itemFullFillRec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item', });
      //                     let orderline = itemFullFillRec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'orderline', });

      //                     //no need filter by orderline
      //                     let itemFullFill = itemArr.filter(x => x.itemId == itemId && x.lineNumber == orderline);
      //                     if (itemFullFill.length > 0) {
      //                         // const results = loadBinData.filter(element => {
      //                         //     return element.internalid == itemId && isExits(element.bin_number, itemArr);
      //                         // });
      //                         let preferredBinObj = loadBinData.filter(element => { return element.internalid == itemId && element.bin_number == itemFullFill[0].preferredBin; });
      //                         let alternateBinObj = loadBinData.filter(element => { return element.internalid == itemId && element.bin_number == itemFullFill[0].alternateBin; });
      //                         let preferredBinQuantity = preferredBinObj.length > 0 ? preferredBinObj[0].available : 0;
      //                         let alternateBinQuantity = alternateBinObj.length > 0 ? alternateBinObj[0].available : 0;

      //                         if (preferredBinQuantity + alternateBinQuantity >= itemFullFill[0].quantity) {
      //                             itemFullFillRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });

      //                             // let newItemFulfillQuantity = itemFullFill[0].quantity <= (preferredBinQuantity + alternateBinQuantity) ? itemFullFill[0].quantity : (preferredBinQuantity + alternateBinQuantity);
      //                             // itemFullFillRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: newItemFulfillQuantity });

      //                             let remainingItemFullfillQuantity = itemFullFill[0].quantity;
      //                             let inventoryDetail = itemFullFillRec.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

      //                             // Remove Existing Inventory Assignment
      //                             let inventoryAssignmentCount = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });
      //                             for (let i = inventoryAssignmentCount - 1; i >= 0; i--) {
      //                                 inventoryDetail.removeLine({ sublistId: 'inventoryassignment', line: i });
      //                             }

      //                             // FIFO Assign Preferred Bin First Then Alternate Bin
      //                             if (preferredBinQuantity > 0 && remainingItemFullfillQuantity > 0) {
      //                                 // Preferred Bin
      //                                 let assignQuantity = remainingItemFullfillQuantity <= preferredBinQuantity ? remainingItemFullfillQuantity : preferredBinQuantity;
      //                                 inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
      //                                 inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', value: itemFullFill[0].preferredBin });
      //                                 inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'tobinnumber', value: itemFullFill[0].preferredBin });
      //                                 inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: assignQuantity });
      //                                 inventoryDetail.commitLine('inventoryassignment');

      //                                 remainingItemFullfillQuantity -= assignQuantity;
      //                             }
      //                             if (alternateBinQuantity > 0 && remainingItemFullfillQuantity > 0) {
      //                                 // Alternate Bin
      //                                 let assignQuantity = remainingItemFullfillQuantity <= alternateBinQuantity ? remainingItemFullfillQuantity : alternateBinQuantity;
      //                                 inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
      //                                 inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', value: itemFullFill[0].alternateBin });
      //                                 inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'tobinnumber', value: itemFullFill[0].alternateBin });
      //                                 inventoryDetail.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: assignQuantity });
      //                                 inventoryDetail.commitLine('inventoryassignment');

      //                                 remainingItemFullfillQuantity -= assignQuantity;
      //                             }

      //                             fulfilledLinesArray.push(itemFullFillRec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', }));
      //                         } else {
      //                             itemFullFillRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false, });
      //                             fulfilledLinesArray.push(itemFullFillRec.getCurrentSublistValue({
      //                                 sublistId: 'item',
      //                                 fieldId: 'itemreceive',
      //                             }));
      //                             log.debug('Information', 'JCS Automation Item Fulfillment | Item ' + itemFullFill[0]?.itemText + ' | Preferred Bin ' + itemFullFill[0]?.preferredBin + ' has ' + preferredBinQuantity + ' quantity and Alternate Bin ' + itemFullFill[0]?.alternateBin + ' has ' + alternateBinQuantity + ' quantity but you are trying to fulfill ' + itemFullFill[0]?.quantity + ' quantity. Please check the quantity and try again.');
      //                         }
      //                         itemFullFillRec.commitLine({ sublistId: 'item' });

      //                     } else {

      //                         fulfilledLinesArray.push(itemFullFillRec.getCurrentSublistValue({
      //                             sublistId: 'item',
      //                             fieldId: 'itemreceive',
      //                             line: k
      //                         }));
      //                         itemFullFillRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false });
      //                     }

      //                     itemFullFillRec.commitLine({ sublistId: 'item' });
      //                 }
      //                 if (fulfilledLinesArray.length > 0) {
      //                     if (fulfilledLinesArray.includes(true)) {
      //                         let itemFullfillmentId = itemFullFillRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
      //                         log.debug('💾 Item Fulfillment', 'ID ' + itemFullfillmentId);
      //                     }
      //                 }
      //             }
      //         }

      //         function getResults(set) {
      //             let holder = [];
      //             let i = 0;
      //             while (true) {
      //                 let result = set.getRange({
      //                     start: i,
      //                     end: i + 1000
      //                 });
      //                 if (!result) break;
      //                 holder = holder.concat(result);
      //                 if (result.length < 1000) break;
      //                 i += 1000;
      //             }
      //             return holder;
      //         };

      //         function hasValue(value) {
      //             let isContain = false;
      //             if (value != undefined && value != null && value != '') {
      //                 isContain = true;
      //             }
      //             return isContain;
      //         }

      //         function isExits(value, arr) {
      //             let obj = arr.find(o => o.preferredBin === value)
      //             if (obj) {
      //                 return true;
      //             } else {
      //                 return false;
      //             }
      //         }

      //         function getBinQuantityLocationData(location, binnumber) {
      //             let query = search.load({
      //                 id: 'customsearch_jcs_bin_on_hands'
      //             });
      //             query.filters.push(search.createFilter({
      //                 name: 'location',
      //                 join: 'binOnHand',
      //                 operator: search.Operator.ANYOF,
      //                 values: location
      //             }));
      //             if (binnumber.length > 0) {
      //                 binnumber = binnumber.filter((val) => { return val != null && val != '' });
      //                 if (binnumber.length > 0) {
      //                     query.filters.push(search.createFilter({
      //                         name: 'binnumber',
      //                         join: 'binOnHand',
      //                         operator: search.Operator.ANYOF,
      //                         values: binnumber
      //                     }));
      //                 }

      //             }
      //             let results = getResults(query.run())
      //             results = results.map(mapBinQuantityLocationData)
      //             return results;
      //         }

      //         function mapBinQuantityLocationData(data) {
      //             return {
      //                 'internalid': data.id,
      //                 'item': data.getValue(data.columns[0]),
      //                 'location': data.getValue(data.columns[1]),
      //                 'bin_number': data.getValue(data.columns[2]),
      //                 'bin_number_text': data.getText(data.columns[2]),
      //                 //'available': parseFloatOrZero(data.getValue(data.columns[4])),
      //                 'available': data.getText(data.columns[4]) == 'Per 1000' ? parseFloatOrZero(data.getValue(data.columns[4])) * 1000 : parseFloatOrZero(data.getValue(data.columns[4])),
      //             };
      //         };
      //     } catch (error) {
      //         log.debug('Error', error);
      //     }
      //     logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | afterSubmit | JCS Automation Item Fulfillment' });
      // }
      // //#endregion

      //#region 📜 Sales Order | Move From JCS Job Variation UE | Related to variation, can be isolated to run only on Variation button | 🔗 https://5281669-sb1.app.netsuite.com/app/common/scripting/script.nl?id=1579&e=T
      if (newRecord.type === record.Type.SALES_ORDER && [context.UserEventType.CREATE].includes(context.type) && runtime.executionContext != runtime.ContextType.SUITELET && subsidiary == Enum.Subsidiary.DDC) {
        let logObj = logStart();
        let tranid = search.lookupFields({ type: search.Type.SALES_ORDER, id: newRecord.id, columns: ['tranid'] }).tranid;
        record.submitFields({
          type: record.Type.SALES_ORDER,
          id: newRecord.id,
          values: {
            custbody_ddc_job_order_number: tranid,
            custbody_ddc_linked_variations_count: '',
            custbody_ddc_linked_parent_job: ''
          }
        });
        logEnd({ logObj: logObj, message: 'ID ' + newRecord.id + ' | ' + context.type + ' | afterSubmit | Job Variation' });
      }
      //#endregion

      // //Start Run Creation UE
      // //let { oldRecord, newRecord } = scriptContext
      // let updatefieldObj = {};
      // let { type, id } = newRecord
      // //let rec = record.load({ type, id })
      // //var subsidiary = rec.getValue({ fieldId: 'subsidiary' });
      // var isRunCreated = newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });
      // var productApprovalStatus = newRecord.getValue({ fieldId: 'custbody_ddc_production_approvalstatus' });
      // if (isRunCreated) {
      //     return;
      // }
      // log.debug("subsidiary", subsidiary);
      // if (subsidiary != '2') {
      //     return;
      // }
      // let jobNo = newRecord.getValue({ fieldId: 'custbody_ddc_job_no_without_prefix' })
      // let executionContext = runtime.executionContext
      // let status = {
      //     old: oldRecord ? oldRecord.getValue({ fieldId: 'status' }) : '',
      //     new: newRecord.getValue({ fieldId: 'status' })
      // }
      // let orderStatus = {
      //     old: oldRecord ? oldRecord.getValue({ fieldId: 'orderstatus' }) : '',
      //     new: newRecord.getValue({ fieldId: 'orderstatus' })
      // }
      // log.debug('------ [START] ------', { type, id, jobNo, eventType: context.type, executionContext, status, orderStatus })

      // let invokeMapReduce = false
      // try {
      //     if (context.type.match(/create|copy|edit|approve/g)) {
      //         if (status.old != status.new && status.new.match(/pending fulfill|pending bill/gi)) {
      //             if (!countRelatedRuns(id)) {
      //                 log.debug('run creation', 'stage 2');
      //                 //let newRecord = record.load({ type, id });
      //                 let xmlStr = newRecord.getValue({ fieldId: 'custbody_ddc_run_schedule_dates' })
      //                 let runs = jobRunSchedules(id, jobNo, xmlStr);
      //                 log.debug('run creation', 'stage 3 : run.length:'+runs.length);
      //                 if (runs.length) {
      //                     let runDetailItems = jobRunDetailItems(runs, id);
      //                     log.debug('run creation', 'stage 4');
      //                     // Map site and run details per run schedule
      //                     runs = runs.map(m => {
      //                         m.custrecord_ddc_run_site = newRecord.getValue({ fieldId: 'custbody_ddc_site' })
      //                         m.details = JSON.parse(JSON.stringify(runDetailItems)) // Clone run details per run schedule
      //                         return m
      //                     })
      //                     log.debug(`JobId:${id} => Runs for creation`, runs)
      //                     //newRecord.setValue({ fieldId: 'custbody_ddc_job_status', value: 2 }) // In Progress
      //                     updatefieldObj['custbody_ddc_job_status'] = 2;
      //                     newRecord.setValue({ fieldId: 'custbody_ddc_runs_created', value: true }) // In Progress
      //                     updatefieldObj['custbody_ddc_runs_created'] = true;
      //                     for (run of runs) {
      //                         if (cm.getRemainingUsage() < 100) {
      //                             invokeMapReduce = true
      //                             break
      //                         }
      //                         try {
      //                             run.id = ns_utils.createRecord(run.type, run);
      //                             log.debug('run creation', 'stage 5: run.id : ' + run.id);
      //                             for (detail of run.details) {
      //                                 if (cm.getRemainingUsage() < 100) {
      //                                     invokeMapReduce = true
      //                                     break
      //                                 }
      //                                 detail.custrecord_ddc_rd_parent_run = run.id
      //                                 detail.custrecord_ddc_rd_planned_startdate = run.custrecord_ddc_run_planned_startdate
      //                                 detail.custrecord_ddc_rd_planned_enddate = run.custrecord_ddc_run_planned_enddate
      //                                 detail.custrecord_ddc_rd_prod_approval_status = productApprovalStatus
      //                                 try {
      //                                     detail.id = ns_utils.createRecord(detail.type, detail);
      //                                     log.debug('run creation', 'stage 6: detail.id : ' + detail.id);
      //                                 } catch (e) {
      //                                     log.debug(`JobId:${id} => Run detail creation error: ${detail.custrecord_ddc_rd_lineid}`, e.message)
      //                                 }
      //                                 //Code added by kamlesh on 22 May 2024
      //                                 //pass run details creation to map reduce script after creating one run details
      //                                 invokeMapReduce = true;
      //                                 break;

      //                             }
      //                         } catch (e) {
      //                             log.debug(`JobId:${id} => Run creation error:${run.custrecord_ddc_run_id}`, e.message)
      //                         }
      //                     }

      //                     log.debug(`JobId:${id} => runs length : ${runs.length}`, runs)
      //                     if (!invokeMapReduce) {
      //                         //newRecord.setValue({ fieldId: 'custbody_run_creation_ready', value: true });
      //                         updatefieldObj['custbody_run_creation_ready'] = true;
      //                     }
      //                     else {
      //                         //newRecord.setValue({ fieldId: 'custbody_run_creation_ready', value: false });
      //                         updatefieldObj['custbody_run_creation_ready'] = false;
      //                     }

      //                     //newRecord.save({ ignoreMandatoryFields: true });
      //                     if (invokeMapReduce) {
      //                         log.debug('run creation', 'stage 7: invokeMapReduce : ' + invokeMapReduce);
      //                         var tetsRun = [];
      //                         for (var i = 0; i < runs.length; i++) {
      //                             var item = runs[i];
      //                             var runDetails = item.details;
      //                             var testRunDetails = [];
      //                             for (var j = 0; j < runDetails.length; j++) {
      //                                 if (runDetails[j].id == '' && item.id!='') {
      //                                     testRunDetails.push(runDetails[j]);
      //                                 }
      //                             }
      //                             if(testRunDetails.length > 0){
      //                                 item.details = testRunDetails;
      //                                 tetsRun.push(item);
      //                             }

      //                         }
      //                         log.debug('tetsRun', tetsRun)

      //                         runs = runs
      //                         .filter(r => !r.id)
      //                         .filter(r => {// Filter out run details with internalid
      //                             r.details = r.details.filter(rd => !rd.id)
      //                             return r.details.length
      //                         })
      //                         var arr3 = [...runs, ...tetsRun];
      //                         arr3.map(m => cm.unParseDateValueFields(m))
      //                         log.debug(`JobId:${id} => MapReduce runs length : ${runs.length}`, arr3.length)
      //                         if (arr3.length) {
      //                             var taskid = task.create({
      //                                 taskType: task.TaskType.MAP_REDUCE,
      //                                 params: {
      //                                     custscript_jcs_run_creation_jobid: id,
      //                                     custscript_jcs_run_creation_array: JSON.stringify(arr3)
      //                                 },
      //                                 scriptId: 'customscript_jcs_run_creation_mr'
      //                             }).submit()
      //                             log.debug('run creation', 'stage 8: taskid : ' + taskid);
      //                         }
      //                         // if (arr3.length) {
      //                         //     task.create({
      //                         //         taskType: task.TaskType.MAP_REDUCE,
      //                         //         params: {
      //                         //             custscript_jcs_run_creation_jobid: id,
      //                         //             custscript_jcs_run_creation_array: JSON.stringify(arr3)
      //                         //         },
      //                         //         scriptId: 'customscript_jcs_run_creation_mr'
      //                         //     }).submit()

      //                         // }
      //                     }
      //                     if(updatefieldObj.hasOwnProperty('custbody_ddc_job_status')){
      //                         log.debug('run creation', 'stage 9: updatefieldObj : ' + JSON.stringify(updatefieldObj));
      //                         record.submitFields({
      //                             type: type,
      //                             id: id,
      //                             values: updatefieldObj
      //                         });
      //                     }
      //                 }
      //             }
      //         }
      //     }
      // } catch (e) {
      //     log.debug(`JobId:${id} => afterSubmit error`, e.message)
      // }
      //End run creation UE
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

        // let suiteQL = "SELECT id \n";
        // columns.forEach(column => {
        //     suiteQL += ", " + column + " \n";
        // });
        // suiteQL += "FROM item \n";
        // suiteQL += "WHERE id IN (" + itemIds.join(',') + ") \n";
        // itemResults = getSuiteQLResults({ suiteQL });
      }
      return itemResults;
    }

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
      let reportExecuteTime = `${Math.floor((reportEnd - reportStart) / 60000)} Minutes ${((reportEnd - reportStart) / 1000) % 60} Seconds`;
      secondwith3Decimal = (reportEnd - reportStart) / 1000;
      log.audit('Execution Log', message + ' | ' + runtime.executionContext + ' | Execution Time ' + reportExecuteTime + ' | Used Governance ' + (reportUsageLimit - scriptObj.getRemainingUsage()) + '/' + reportUsageLimit + ' Units');
    }

    const parseFloatOrZero = n => parseFloat(n) || 0
    const parseFloatOrZeroSec = n => {
      if (n === '' || n == null) {
        return ''
      } else {
        return parseFloat(n) || 0;
      }
    }

    //Start Run Creation UE Functions
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

    //End Run Creation UE Functions

    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit,
      afterSubmit: afterSubmit
    };
  });