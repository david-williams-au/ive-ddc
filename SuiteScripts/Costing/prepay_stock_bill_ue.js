/**
 * @name:                                       prepay_stock_bill_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description - Removes Inventory from Bill when Customer Prepay Item scenario. Only bill the Prepay service item.
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Wed Nov 09 2022 8:26:31 AM
 * Change Logs:
 * Date                          Author               Description
 * Wed Nov 09 2022 8:26:31 AM -- Patrick Lising -- Initial Creation
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Vendor Bill
 */

define(['N/record', 'N/search'], function (record, search) {

  function prepay_bill_beforeSubmit(context) {
    var billRec = context.newRecord;
    var subsidiary = billRec.getValue('subsidiary');
    log.debug("subsidiary", subsidiary);
    //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
    if (subsidiary != '2') {
      return;
    }

    if (context.type == 'create') {
      var lineCount = billRec.getLineCount({
        sublistId: "item"
      })

      for (var i = 0; i < lineCount; i++) {

        var itemRate = billRec.getSublistValue({
          sublistId: "item",
          fieldId: "rate",
          line: i
        })

        if (itemRate == '0') { //if rate is 0, check if item is customer owned

          var itemId = billRec.getSublistValue({
            sublistId: "item",
            fieldId: "item",
            line: i
          })

          var itemLookup = search.lookupFields({
            type: search.Type.ITEM,
            id: itemId,
            columns: 'custitem_ddc_is_cust_owned'
          })

          var customerOwned = itemLookup.custitem_ddc_is_cust_owned

          log.debug({
            title: 'customerOwned',
            details: 'customerOwned val: ' + customerOwned
          })

          if (customerOwned) {
            //remove line item that has 0 rate and is customer owned

            billRec.removeLine({
              sublistId: 'item',
              line: i
            });

          }
        }
      }
    }
  }


  return {
    beforeSubmit: prepay_bill_beforeSubmit
  }
});