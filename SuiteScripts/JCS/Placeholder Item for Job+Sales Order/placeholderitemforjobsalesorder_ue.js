/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @name:                                       placeholderitemforjobsalesorder_ue.js
 * @author:                                     Junnel C. Mercado
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Thu Aug 17 2023 9:56:58 AM
 * Change Logs:
 * Date                          Author               Description
 * Thu Aug 17 2023 9:56:58 AM -- Junnel C. Mercado -- Initial Creation
 */

/**
 * @deployedto Job
 */

define(['N/record', 'N/search', 'N/runtime', 'N/email', 'N/render', 'N/ui/serverWidget'],
  /**
   * @param{record} record
   * @param{search} search
   * @param{runtime} runtime
   * @param{email} email
   * @param{render} render
   * @param{serverWidget} serverWidget
   */
  (record, search, runtime, email, render, serverWidget) => {
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
      let newRecord = scriptContext.newRecord;
      let form = scriptContext.form;

      let userObj = runtime.getCurrentUser();
      let userRole = userObj.role;

      let scriptObj = runtime.getCurrentScript();
      // let fieldIdsParameter = scriptObj.getParameter({name: 'custscript_jcs_placeholder_item_field_ids'});
      // let fieldIds = fieldIdsParameter.split(',');
      // let fieldIdsLength = fieldIds.length;

      if (scriptContext.type == 'edit') {
        const customer = newRecord.getValue({ fieldId: 'entity' });
        const subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
        log.emergency({
          title: 'subsidiary',
          details: subsidiary
        })
        //GR - Adding this in now to stop error for Logistics Business. Jay to confirm later.
        //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
        if (subsidiary != '2') {
          return;
        }

        let itemSublist = form.getSublist({ id: 'item' });
        let getPlaceHolderField = itemSublist.getField({ id: 'custcol_placeholder_replacement_item' });
        log.emergency({
          title: 'getPlaceHolderField',
          details: getPlaceHolderField
        })
        log.emergency({
          title: 'getPlaceHolderField length',
          details: Object.keys(getPlaceHolderField).length
        })
        if (Object.keys(getPlaceHolderField).length > 0) {
          getPlaceHolderField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
        }

        let addPlaceHolderColumnField = itemSublist.addField({
          id: 'custpage_placeholderitem',
          type: serverWidget.FieldType.SELECT,
          label: 'Available Replacement Items'
        });
        addPlaceHolderColumnField.addSelectOption({
          value: '',
          text: ''
        });

        addPlaceHolderColumnField.addSelectOption({
          value: '8667',
          text: 'Customer Prepay Item'
        });

        addPlaceHolderColumnField.addSelectOption({
          value: '8668',
          text: 'Customer Prepay Item - Intercompany'
        });
        let placeHolderList = loadPlaceHolderItems(customer, subsidiary);
        if (placeHolderList.length > 0) {
          placeHolderList.forEach((item) => {
            addPlaceHolderColumnField.addSelectOption({
              value: item.id,
              text: item.displayName
            });
          });
        }
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
      let newRecord = scriptContext.newRecord;

      // GR START - Adding Sub checking
      const subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      log.emergency({
        title: 'subsidiary',
        details: subsidiary
      })
      //GR - Adding this in now to stop error for Logistics Business. Jay to confirm later.
      //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
      if (subsidiary != '2') {
        return;
      }
      // GR END - Adding Sub checking


      const itemLineCount = newRecord.getLineCount({ sublistId: 'item' });

      // const fieldIdsArrays = [{
      //     fieldId: 'custcol_ddc_manualquote_cb',
      // },
      // {
      //     fieldId: 'quantity',
      // }];

      const fieldIdsArrays = getFieldsFilter();
      log.emergency({
        title: 'fieldIdsArrays',
        details: fieldIdsArrays
      })
      var objectifyArray = fieldIdsArrays.reduce((obj, item) => (obj[item.fieldId] = item, obj), {});
      log.emergency({
        title: 'objectifyArray',
        details: objectifyArray
      })
      let arrayHolder = [];
      for (let index = 0; index < itemLineCount; index++) {
        let placeholderReplacement = newRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_placeholder_replacement_item',
          line: index
        });
        if (placeholderReplacement) {
          arrayHolder.push({
            fieldId: `item`,
            line: index,
            unique_line_key: newRecord.getSublistValue({
              sublistId: 'item',
              fieldId: 'lineuniquekey',
              line: index
            }),
            value: placeholderReplacement
          });
          // Check if the placeholder item is already in the array
          Object.keys(objectifyArray).forEach((key) => {
            let fieldObj = newRecord.getSublistField({
              sublistId: 'item',
              fieldId: `${objectifyArray[key].fieldId}`,
              line: index
            });
            if (fieldObj) {
              let getFieldValue = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: `${objectifyArray[key].fieldId}`,
                line: index
              });
              log.emergency({
                title: 'getFieldValue',
                details: getFieldValue
              });
              arrayHolder.push({
                fieldId: `${objectifyArray[key].fieldId}`,
                line: index,
                unique_line_key: newRecord.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'lineuniquekey',
                  line: index
                }),
                value: getFieldValue
              });
            } else {
              throw `Field ${objectifyArray[key].fieldId} does not exist in the item sublist. Please check the field id. `
            }
          });

          log.emergency({
            title: 'arrayHolder',
            details: arrayHolder
          })
        }
        newRecord.setSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_placeholder_replacement_item',
          line: index,
          value: ''
        });
      }
      if (arrayHolder.length > 0) {
        arrayHolder.forEach((item) => {
          let findLineNumber = newRecord.findSublistLineWithValue({
            sublistId: 'item',
            fieldId: 'lineuniquekey',
            value: item.unique_line_key
          });
          newRecord.setSublistValue({
            sublistId: 'item',
            fieldId: `${item.fieldId}`,
            line: findLineNumber,
            value: item.value
          });
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

    }

    const loadPlaceHolderItems = (customer, subsidiary) => {
      let array = []
      if (customer) {
        var filterArray = [
          ["subsidiary", "anyof", subsidiary],
          "AND",
          ["type", "anyof", "InvtPart"],
          "AND",
          [["custitem_ddc_owned_by_cust", "anyof", customer], "OR", ["custitem_ddc_is_cust_owned", "is", "F"]]
        ]
      } else {
        var filterArray = [
          ["subsidiary", "anyof", subsidiary],
          "AND",
          ["type", "anyof", "InvtPart"],
          "AND",
          ["custitem_ddc_is_cust_owned", "is", "F"]
        ]
      }
      log.debug("filterArray", filterArray);

      var inventoryitemSearchObj = search.create({
        type: "inventoryitem",
        filters: filterArray,
        columns:
          [
            search.createColumn({ name: "internalid", label: "Internal ID" }),
            search.createColumn({ name: "displayname", label: "Display Name" }),
            search.createColumn({
              name: "itemid",
              sort: search.Sort.ASC,
              label: "Name"
            })
          ]
      });
      var searchResultCount = inventoryitemSearchObj.runPaged().count;
      log.debug("inventoryitemSearchObj result count", searchResultCount);
      inventoryitemSearchObj.run().each(function (result) {
        // .run().each has a limit of 4,000 results
        var id = result.getValue('internalid')
        var displayName = result.getValue('itemid')
        array.push({
          id: id,
          displayName: displayName
        });
        return true;
      });
      return array;
    }

    /** 
    * @name getFieldsFilter
    * @description Load a custom record that holds fields internal id
    *
    * @returns {results} array
    */
    const getFieldsFilter = () => {
      let query = search.load({
        id: 'customsearch_jcs_ddc_rtn_ln_flds'
      });
      query.filters.push(search.createFilter({
        name: 'custrecord_ddc_rlf_context',
        operator: search.Operator.ANYOF,
        values: 3
      }));
      let results = query.run()
      let arrayResults = results.getRange({
        start: 0,
        end: 1000
      })
      let dataResults = arrayResults.map(mapFieldsFilter)
      return dataResults;
    }
    const mapFieldsFilter = (data) => {
      return {
        // 'internalid': data.id,
        'fieldId': data.getValue(data.columns[2]),
      };
    };

    return { beforeLoad, beforeSubmit, afterSubmit }

  });