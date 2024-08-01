/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @name:                                       header_management_ue.js
 * @author:                                     Junnel C. Mercado
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Wed Mar 13 2024 8:31:57 AM
 * Change Logs:
 * Date                          Author               Description
 * Wed Mar 13 2024 8:31:57 AM -- Junnel C. Mercado -- Initial Creation
 */

/**
 * @deployedto Job
 */

define(['N/record', 'N/log', 'N/file', 'N/search', 'N/runtime'],
  /**
* @param{record} record
* @param{log} log
* @param{file} file
* @param{search} search
* @param{runtime} runtime
*/
  (record, log, file, search, runtime) => {
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
      let newRecord = scriptContext.newRecord;
      let oldRecord = scriptContext.oldRecord;
      let type = scriptContext.type;
      let itemArray = []

      log.emergency({
        title: 'type subsidiary and context',
        details: {
          type: type,
          subsidiary: newRecord.getValue({ fieldId: 'subsidiary' }),
          runtime: runtime.executionContext
        }
      });

      let subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      if (subsidiary == 2 && runtime.executionContext != 'SUITELET' && runtime.executionContext != 'SCHEDULED') {

        const getCreatedFromField = newRecord.getValue({ fieldId: 'createdfrom' });
        log.emergency({
          title: 'getCreatedFromField',
          details: getCreatedFromField
        });
        if (getCreatedFromField) {
          // look up from field record type
          const createdFromType = getCreatedFromField ? search.lookupFields({
            type: 'transaction',
            id: getCreatedFromField,
            columns: ['type']
          }) : '';
          const fromTypeValue = Object.keys(createdFromType).length > 0 ? createdFromType.type[0].value : '';
          log.emergency({
            title: 'fromTypeValue',
            details: {
              createdFromType: createdFromType,
              fromTypeValue: fromTypeValue
            }
          })

          if (fromTypeValue == 'Estimate' && type == 'create') {
            let quoteArray = []
            let quoteJobArray = []
            // load Estimate Record
            let estimateRecord = record.load({ type: record.Type.ESTIMATE, id: getCreatedFromField });
            // Get Quote Line Count
            let lineCount = estimateRecord.getLineCount({ sublistId: 'item' });
            // Get Job on creation line count
            let quoteJobLineCount = newRecord.getLineCount({ sublistId: 'item' });

            // Needs to have a parameter or a list of item ids
            const itemIds = ['16638', '16637', '16639', '16664', '16666'];

            // Loop trough the line items and store to array based rate and quantity
            for (let i = 0; i < lineCount; i++) {
              let quoteItem = estimateRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
              let quoteRate = estimateRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
              let quoteAmount = estimateRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
              let quoteUniqueKey = estimateRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', line: i });
              let quoteId = estimateRecord.getSublistValue({ sublistId: 'item', fieldId: 'id', line: i });

              let postageManagementAmount = itemIds.includes(quoteItem) ? quoteAmount : '';

              quoteArray.push({
                index: i,
                item: quoteItem,
                rate: quoteRate,
                amount: quoteAmount,
                unique_key: quoteUniqueKey,
                id: quoteId,
                postage_management_amount: postageManagementAmount
              });
            }

            for (let i = 0; i < quoteJobLineCount; i++) {
              let quoteJobItem = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
              let quoteJobRate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
              let quoteJobAmount = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
              let quoteJobUniqueKey = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', line: i });
              let quoteJobId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'id', line: i });

              quoteJobArray.push({
                index: i,
                item: quoteJobItem,
                rate: quoteJobRate,
                amount: quoteJobAmount,
                unique_key: quoteJobUniqueKey,
                id: quoteJobId
              });
            };

            quoteJobArray.filter(quotedJobArrayVal => quoteArray.find(quoteArrayVal => {
              if (quoteArrayVal.unique_key == quotedJobArrayVal.unique_key) {
                let lineItem = newRecord.findSublistLineWithValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', value: quotedJobArrayVal.unique_key });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_quoted_rate', line: lineItem, value: quoteArrayVal.rate });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_quoted_amount', line: lineItem, value: quoteArrayVal.amount });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_q_post_man_fee_amt', line: lineItem, value: quoteArrayVal.postage_management_amount });
              }
            }))
          }
        }

        if (type == 'edit') {
          // Get ID
          let id = newRecord.id;
          log.emergency({
            title: 'id',
            details: id
          })
          // Get Job Status
          let oldJobStatus = oldRecord.getValue({ fieldId: 'custbody_ddc_job_status' });
          let newJobStatus = newRecord.getValue({ fieldId: 'custbody_ddc_job_status' });

          log.emergency({
            title: 'status',
            details: {
              oldJobStatus: oldJobStatus,
              newJobStatus: newJobStatus
            }
          });

          // Check if the job status is in progress or pending client delivery review
          if (oldJobStatus == 2 && newJobStatus == 10) {
            log.emergency({
              title: 'pass',
              details: 'pass'
            })
            let lineCount = newRecord.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < lineCount; i++) {
              let quantity = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
              let actualQuantity = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i });
              let excludeInvoicePDFValue = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_invoice_pdf', line: i });

              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_bill_qty_b4_preinvoice', line: i, value: quantity });
              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty_b4_preinvoice', line: i, value: actualQuantity });
              newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_excl_from_pdf_b4_preinv', line: i, value: excludeInvoicePDFValue });
            }

            var searchArray = searchSalesOrderHeaderLinesMain(id)
            // createTextFile(JSON.stringify(searchArray), 'searchArray.txt');
            // Object grouping
            var arrayGrouping = nestGroupsBy(searchArray, ['stream_name', 'item_category']);
            // Third object grouping
            let setupArray = []
            Object.keys(arrayGrouping).forEach((headerKeys) => {
              let arrayObject = arrayGrouping[headerKeys];
              Object.keys(arrayObject).forEach((subKeys) => {
                let subData = arrayObject[subKeys];
                let setupKeyValue = ''
                // console.log(subData)
                subData.forEach((value, index) => {
                  if (value.is_setup_item == 'T') {
                    setupKeyValue = `${headerKeys} - ${subKeys} - ${value.memo}`;
                  } else if (setupKeyValue) {
                    setupKeyValue = setupKeyValue;
                  } else {
                    setupKeyValue = ''
                  }
                  if (setupKeyValue) {
                    value.setup_grouping = setupKeyValue
                  }
                  setupArray.push(value);
                })
              });
            });
            let finalGrouping = nestGroupsBy(setupArray, ['stream_name', 'item_category', 'setup_grouping']);

            Object.keys(finalGrouping).forEach((headerKeys) => {
              let arrayObject = finalGrouping[headerKeys];
              let mainKeyString = '';
              let mainHeaderStatus = []
              Object.keys(arrayObject).forEach((subKeys) => {
                let subData = arrayObject[subKeys];
                let groupedHeaderStatus = [];
                Object.keys(subData).forEach((mergedKeys) => {
                  // console.log(`${headerKeys} - ${subKeys}`)
                  let mergedKeysData = subData[mergedKeys];
                  let setupItemQuantity = 0;
                  let setupItemQuantityCheck = false;
                  let noneGroupedHeaderStatus = [];
                  mergedKeysData.map((valueMapKeys, indexMapKeys) => {
                    let lineNumber = newRecord.findSublistLineWithValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', value: valueMapKeys.unique_id });
                    let getCurrentQuantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNumber });
                    // log.emergency({
                    //     title: 'quantity',
                    //     details: {
                    //         getCurrentQuantity: getCurrentQuantity,
                    //         valueMapKeys: valueMapKeys,
                    //         setupItemQuantityCheck: setupItemQuantityCheck
                    //     }
                    // });
                    if (valueMapKeys.setup_grouping) {
                      // Check if setup item is 0 quantity
                      // if the setup item is 0 then set all the related items under the setup item as 0

                      if (valueMapKeys.is_setup_item == 'T') {
                        if (getCurrentQuantity == 0) {
                          // console.log(valueMapKeys)
                          valueMapKeys.exclude_from_invoice = true
                          setupItemQuantityCheck = true;
                        }
                        valueMapKeys.quantity = getCurrentQuantity
                        groupedHeaderStatus.push(valueMapKeys.exclude_from_invoice)
                      } else if (valueMapKeys.is_setup_item == 'F') {
                        // If True set quantity to 0
                        // This is related if the setup item is true
                        if (setupItemQuantityCheck) {
                          //    console.log(valueMapKeys)
                          valueMapKeys.quantity = 0
                          valueMapKeys.exclude_from_invoice = true
                          // log.emergency({
                          //     title: 'Setup Item Quantity Check true',
                          //     details: valueMapKeys
                          // });
                        } else {
                          // Check the line if its 0 then set exclude from invoice to true
                          if (getCurrentQuantity == 0) {
                            // log.emergency({
                            //     title: 'Setup Item Quantity Check false and is 0',
                            //     details: valueMapKeys
                            // });
                            valueMapKeys.quantity = 0;
                            valueMapKeys.exclude_from_invoice = true
                          } else {
                            // log.emergency({
                            //     title: 'Setup Item Quantity Check false and if not 0',
                            //     details: valueMapKeys
                            // });
                            valueMapKeys.exclude_from_invoice = false
                          }
                        }
                        groupedHeaderStatus.push(valueMapKeys.exclude_from_invoice)
                      }
                      // console.log(valueMapKeys)
                    } else {
                      // log.emergency({
                      //     title: 'None Setup Item grouping',
                      //     details: valueMapKeys
                      // });
                      if (indexMapKeys != 0) {
                        if (getCurrentQuantity == 0) {
                          valueMapKeys.quantity = 0
                          valueMapKeys.exclude_from_invoice = true
                        }
                        noneGroupedHeaderStatus.push(valueMapKeys.exclude_from_invoice)
                      }
                    }

                  });
                  // console.log(groupedHeaderStatus);
                  mergedKeysData.map((valueMapKeys, indexMapKeys) => {
                    if (valueMapKeys.is_main_header == 'YES') {
                      mainKeyString = valueMapKeys.item_category
                    }
                    if (!valueMapKeys.setup_grouping) {
                      if (indexMapKeys == 0) {
                        if (noneGroupedHeaderStatus.includes(false)) {
                          valueMapKeys.exclude_from_invoice = false
                        } else {
                          valueMapKeys.exclude_from_invoice = true
                        }
                      }
                    }
                  });
                });

                // console.log(groupedHeaderStatus)
                // console.log(subData[''])
                subData[''].forEach((values, index) => {
                  if (values.is_child_of_main_header == 'YES') {
                    if (groupedHeaderStatus.includes(false)) {
                      values.exclude_from_invoice = false
                    } else if (groupedHeaderStatus.includes(true)) {
                      values.exclude_from_invoice = true
                    }
                    // console.log(values);
                    mainHeaderStatus.push(values.exclude_from_invoice);
                  }
                });
              });
              // console.log(mainHeaderStatus);
              // console.log(mainKeyString)
              // console.log(arrayObject[mainKeyString][''])
              if (mainKeyString) {
                let finalArray = arrayObject[mainKeyString]['']
                finalArray.forEach((value, index) => {
                  if (value.is_main_header == 'YES') {
                    if (mainHeaderStatus.includes(false)) {
                      value.exclude_from_invoice = false
                    } else {
                      value.exclude_from_invoice = true
                    }
                  }
                })
              }
            });

            //Loop through the finalArray and set the value to the sublist
            Object.keys(finalGrouping).forEach((headerKeys) => {
              let arrayObject = finalGrouping[headerKeys];
              Object.keys(arrayObject).forEach((subKeys) => {
                let subData = arrayObject[subKeys];
                Object.keys(subData).forEach((mergedKeys) => {
                  let mergedKeysData = subData[mergedKeys];
                  mergedKeysData.forEach((value, index, array) => {
                    // log.emergency({
                    //     title: 'Final loop data value',
                    //     details: value
                    // })
                    // Find line item using unique key
                    let lineItem = newRecord.findSublistLineWithValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_key_scpq', value: value.unique_id });
                    // Set the value to the sublist
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineItem, value: value.quantity });
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: lineItem, value: value.actual_qty });
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_invoice_pdf', line: lineItem, value: value.exclude_from_invoice });

                    // newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_bill_qty_b4_preinvoice', line: lineItem, value: value.quantity_holder });
                    // newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty_b4_preinvoice', line: lineItem, value: value.actual_qty_holder });
                    // newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_excl_from_pdf_b4_preinv', line: lineItem, value: value.exclude_from_invoice_holder });
                  });
                });
              });
            });
          } else if (oldJobStatus == 10 && newJobStatus == 2) {
            // Reverse the quantity and header status
            let lineCount = newRecord.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
              let lineUniqueKey = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
              let quantityHolder = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_bill_qty_b4_preinvoice', line: i });
              let excludeInvoicePDFValue = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_invoice_pdf', line: i });
              let headerStatus = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_excl_from_pdf_b4_preinv', line: i });
              let actualQuantityHolder = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty_b4_preinvoice', line: i });
              if (lineUniqueKey) {
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i, value: quantityHolder });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty', line: i, value: actualQuantityHolder });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_invoice_pdf', line: i, value: headerStatus });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_actual_qty_b4_preinvoice', line: i, value: '' });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_bill_qty_b4_preinvoice', line: i, value: '' });
                newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_excl_from_pdf_b4_preinv', line: i, value: false });
              }
            }
          } else if (oldJobStatus == 11 && newJobStatus == 3) { // If old status is Postage Recon Ready to Ready for Invoice
            // Postage process
            let postageLines = []
            // Get Line Count
            let lineCount = newRecord.getLineCount({ sublistId: 'item' });
            // Loop through the line items and store to array based on the fieldObject variable
            for (let i = 0; i < lineCount; i++) {
              let itemCategory = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_item_category', line: i });
              let streamNumber = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i });
              let streamName = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });

              if (itemCategory == 20 && !streamName) {
                // let item = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                // let lineList = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'line', line: i });
                // let lineNumber = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'linenumber', line: i });
                // let lineUniqueKey = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                // let itemText = newRecord.getSublistText({ sublistId: 'item', fieldId: 'item', line: i });
                // let description = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });
                // let itemCategoryText = newRecord.getSublistText({ sublistId: 'item', fieldId: 'custcol_ddc_item_category_display', line: i });
                // let headingType = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_heading_type', line: i });
                let quantity = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                // let setupItem = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_setup_item', line: i });
                // let excludeInvoicePDFValue = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_invoice_pdf', line: i });

                // postageLines.push({
                //     index: i,
                //     setup_item: setupItem,
                //     line_list: lineList,
                //     line_number: lineNumber,
                //     line_unique_key: lineUniqueKey,
                //     item: { id: item, text: itemText },
                //     item_text: itemText,
                //     description: description,
                //     item_category: { id: itemCategory, text: itemCategoryText },
                //     item_category_text: itemCategoryText,
                //     stream_number: streamNumber,
                //     stream_name: streamName,
                //     heading_type: headingType,
                //     quantity: quantity,
                //     exclude_invoice_pdf: excludeInvoicePDFValue,
                //     header_status: false, // set to false
                //     quantity_holder: quantity, // set to 0 holder
                //     rate_holder: 0, // set to 0 holder
                //     amount_holder: 0, // set to 0 holder
                //     setup_grouping: '' // set to empty string for setup grouping
                // });

                if (quantity > 0) {
                  newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_exclude_invoice_pdf', line: i, value: false });
                }
              }
            }
          }

          let variationProcessingTotalArray = [];
          let variationProcessingTotalGSTArray = [];

          let lineCountVariation = newRecord.getLineCount({ sublistId: 'item' });
          // Loop through the line items and store to array based on the fieldObject variable
          for (let i = 0; i < lineCountVariation; i++) {
            let variation = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_variation', line: i });
            let gst = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'tax1amt', line: i });
            let amount = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });

            if (variation) {
              variationProcessingTotalArray.push(parseFloatOrZero(amount));
              variationProcessingTotalGSTArray.push(parseFloatOrZero(gst));
            }
          };

          let totalVariationAmount = variationProcessingTotalArray.reduce((a, b) => a + b, 0);
          let totalVariationGSTAmount = variationProcessingTotalGSTArray.reduce((a, b) => a + b, 0);

          newRecord.setValue({ fieldId: 'custbody_ddc_variation_proc_total', value: totalVariationAmount });
          newRecord.setValue({ fieldId: 'custbody_ddc_variation_proc_total_gst', value: totalVariationGSTAmount });

        }
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

    }

    // Check each array of objects inside the object keys if there is a value of 0
    const checkQuantity = (array) => {
      return array.some(item => item.quantity === 0);
    }

    // Function for creating a text file
    // const createTextFile = (data, fileName) => {
    //     let fileObj = file.create({
    //         name: fileName,
    //         fileType: file.Type.PLAINTEXT,
    //         contents: data,
    //         description: 'heading management file',
    //         encoding: file.Encoding.UTF8,
    //         folder: 448186
    //     });
    //     return fileObj.save();
    // }

    // Function for grouping multiple properties
    // const groupBy = (array, key) => {
    //     return array.reduce((result, currentValue) => {
    //         (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
    //         return result;
    //     }, {});
    // }

    /**
     * Creates nested groups by object properties.
     * `properties` array nest from highest(index = 0) to lowest level.
     *
     * @param {String[]} properties
     * @returns {Object}
     */
    function nestGroupsBy(arr, properties) {
      properties = Array.from(properties);
      if (properties.length === 1) {
        return groupBy(arr, properties[0]);
      }
      const property = properties.shift();
      var grouped = groupBy(arr, property);
      for (let key in grouped) {
        grouped[key] = nestGroupsBy(grouped[key], Array.from(properties)); // recursion
      }
      return grouped;
    }

    /**
     * Group objects by property.
     * `nestGroupsBy` helper method.
     *
     * @param {String} property
     * @param {Object[]} conversions
     * @returns {Object}
     */
    function groupBy(conversions, property) {
      return conversions.reduce((acc, obj) => {
        let key = obj[property];
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
      }, {});
    }

    function parseFloatOrZero(a) {
      a = parseFloat(a);
      return isNaN(a) ? 0 : a
    }

    /** 
    * @name searchSalesOrderHeaderLinesMain
    * @description load the saved search of [JCS] Sales Order Transaction Data
    * Search name: 
    * @param {customer} integer
    *
    * @returns {results} array
    */
    var searchSalesOrderHeaderLinesMain = (internalid) => {
      let query = search.load({
        id: 'customsearch_jcs_so_trx_dt'
      });
      query.filters.push(search.createFilter({
        name: 'internalid',
        operator: search.Operator.ANYOF,
        values: internalid
      }));
      let results = getResults(query.run())
      results = results.map(mapSalesOrderHeaderLinesMain)
      return results;
    }

    var mapSalesOrderHeaderLinesMain = (data) => {
      return {
        // 'internalid': data.id,
        'stream_name': data.getValue(data.columns[0]).replace('- None -', ''),
        'item_category': data.getText(data.columns[1]),
        'item_category_values': { id: data.getValue(data.columns[1]), text: data.getText(data.columns[1]) },
        'memo': data.getValue(data.columns[2]),
        'unique_id': data.getValue(data.columns[3]),
        'is_main_header': data.getValue(data.columns[4]),
        'is_child_of_main_header': data.getValue(data.columns[5]),
        'is_setup_item': data.getValue(data.columns[6]),
        'line_id': data.getValue(data.columns[7]),
        'line_id_formula_text': data.getValue(data.columns[8]),
        'quantity': parseFloatOrZero(data.getValue(data.columns[9])),
        'actual_qty': data.getValue(data.columns[10]),
        'exclude_from_invoice': data.getValue(data.columns[11]),
        'quantity_holder': data.getValue(data.columns[9]),
        'actual_qty_holder': data.getValue(data.columns[10]),
        'exclude_from_invoice_holder': data.getValue(data.columns[11]),
        'setup_grouping': '',
      };
    };


    /**
     * DONOT ALTER THIS FUNCTION
     * Retrieves all(even if data is more than 2000) 
     * search results of an nlobjSearchResultSet
     *
     * @param  {resultSet} set search result set to retrieve results
     * @return {Array}     array containing search results
     */
    var getResults = function (set) {
      var holder = [];
      var i = 0;
      while (true) {
        var result = set.getRange({
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


    return {
      // beforeLoad,
      beforeSubmit,
      // afterSubmit 
    }

  });