/**
 * @name:                                       data_processing_items_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Thu Oct 13 2022 9:18:31 AM
 * Change Logs:
 * Date                          Author               Description
 * Thu Oct 13 2022 9:18:31 AM -- Patrick Lising -- Initial Creation
 * Mon Nov 7, 2022 1:00:00 PM -- Patrick Lising -- Changed column to be updated from amount to total cost
 * Tue Nov 8, 2022 1:00:00 PM -- Patrick Lising -- Changed logic to handle both create/update
 * Thu Nov 24 2022 10:31:00 AM -- Patrick Lising -- updated to set the exclude from costings checkbox
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Job
 * @deployedto Quote
 */

define(['N/search'], function (search) {

  function data_processing_beforeSubmit(context) {
    var currRec = context.newRecord;
    var recId = currRec.id;
    var cnt = 0;
    //create scenario

    var subsidiary = currRec.getValue('subsidiary');
    log.debug("subsidiary", subsidiary);
    //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
    if (subsidiary != '2') {
      return;
    }

    // if (context.type == 'create') {
    //check each item of the custitem_ddc_data_processing_item is checked, then set all other data processing items total cost to 0
    var lineCount = currRec.getLineCount({
      sublistId: 'item'
    })

    log.debug({
      title: 'lineCount',
      details: 'lineCount val: ' + lineCount
    })

    for (var i = 0; i < lineCount; i++) {

      var itemCat = currRec.getSublistValue({
        sublistId: 'item',
        fieldId: 'custcol_ddc_item_category',
        line: i
      });

      if (itemCat == 6) {
        var itemId = currRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i
        });

        var dataProcessing = search.lookupFields({
          type: 'item',
          id: itemId,
          columns: ['custitem_ddc_data_processing_item']
        })

        var isDataProcessing = dataProcessing.custitem_ddc_data_processing_item;

        log.debug({
          title: 'isDataProcessing',
          details: 'isDataProcessing val: ' + isDataProcessing
        })

        if (isDataProcessing) {
          log.debug({
            title: 'cnt',
            details: 'cnt val: ' + cnt
          })

          if (cnt > 0) {
            currRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_total_cost',
              line: i,
              value: 0
            });
            currRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_exclude_from_costing',
              line: i,
              value: true
            });
          } else {
            // var itemAmt = currRec.getSublistValue({
            //     sublistId: 'item',
            //     fieldId: 'amount',
            //     line: i
            // });
            // currRec.setSublistValue({
            //     sublistId: 'item',
            //     fieldId: 'custcol_ddc_total_cost',
            //     line: i,
            //     value: itemAmt
            // });
            cnt++
          }
        }
      }
    }

    //} end of context create

    // var dataItemsArr = getDataProcessingItems(recId)

    // log.debug({
    //     title: 'dataItemsArr',
    //     details: 'dataItemsArr value: ' + JSON.stringify(dataItemsArr)
    // })

    // if (dataItemsArr.length > 0) {

    //     for (var i = 0; i < dataItemsArr.length; i++) {
    //         var lineNum = currRec.findSublistLineWithValue({
    //             sublistId: 'item',
    //             fieldId: 'lineuniquekey',
    //             value: dataItemsArr[i].lineKey
    //         });

    //         // currRec.setSublistValue({
    //         //     sublistId: 'item',
    //         //     fieldId: 'amount',
    //         //     line: lineNum,
    //         //     value: dataItemsArr[i].amount
    //         // });

    //         currRec.setSublistValue({
    //             sublistId: 'item',
    //             fieldId: 'custcol_ddc_total_cost',
    //             line: lineNum,
    //             value: dataItemsArr[i].amount
    //         });

    //     }


    // }

  }

  function getDataProcessingItems(recId) {
    var itemArr = []
    var transactionSearchObj = search.create({
      type: "transaction",
      filters:
        [
          ["type", "anyof", "SalesOrd", "Estimate"],
          "AND",
          ["mainline", "is", "F"],
          "AND",
          ["internalid", "anyof", recId],
          "AND",
          ["custcol_ddc__data_processing_item", "is", "T"]
        ],
      columns:
        [
          search.createColumn({
            name: "linesequencenumber",
            sort: search.Sort.ASC,
            label: "Line Sequence Number"
          }),
          search.createColumn({ name: "lineuniquekey", label: "Line Unique Key" }),
          search.createColumn({ name: "item", label: "Item" }),
          search.createColumn({ name: "quantity", label: "Quantity" }),
          search.createColumn({ name: "amount", label: "Amount" })
        ]
    });
    var searchResultCount = transactionSearchObj.runPaged().count;
    log.debug("transactionSearchObj result count", searchResultCount);
    transactionSearchObj.run().each(function (result) {
      // .run().each has a limit of 4,000 results

      var lineKey = result.getValue('lineuniquekey');
      var itemId = result.getValue('item');

      if (itemArr.length > 0) {
        itemArr.push(
          {
            lineKey: lineKey,
            itemId: itemId,
            amount: 0
          }
        )

      } else {

        var amount = result.getValue('amount');
        itemArr.push(
          {
            lineKey: lineKey,
            itemId: itemId,
            amount: amount
          }
        )
      }


      return true;
    });

    /*
    transactionSearchObj.id="customsearch1665624813491";
    transactionSearchObj.title="JCS test Job Items search (copy)";
    var newSearchId = transactionSearchObj.save();
    */


    return itemArr;
  }

  return {
    beforeSubmit: data_processing_beforeSubmit
  }
});