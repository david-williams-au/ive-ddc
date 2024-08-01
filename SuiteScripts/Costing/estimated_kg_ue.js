/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * @deployedto Quote
 */

define(['N/record', 'N/search', 'N/format'], function (record, search, format) {


  function afterSubmit(context) {
    try {
      var newRecord = context.newRecord;
      var transactionId = newRecord.id;
      log.debug("transactionId", transactionId);
      var rec = record.load({
        type: newRecord.type,
        id: transactionId
      })
      var subsidiary = rec.getValue('subsidiary');
      if (subsidiary != '2') {
        return;
      }
      var lineCount = rec.getLineCount({ sublistId: 'item' })
      var arr1 = []
      var arr2 = []
      for (var i = 0; i < lineCount; i++) {
        var lineuniquekey = rec.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
        var item = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
        var linkStock = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_linked_stock_item', line: i });
        var streamNumber = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_number', line: i });
        var streamName = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_stream_name', line: i });
        var estimateKgs = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_estimated_kgs', line: i });
        var key = linkStock + "_" + streamNumber + "_" + streamName;
        var key2 = item + "_" + streamNumber + "_" + streamName;
        arr1.push({
          key: key,
          lineuniquekey: lineuniquekey,
          estimateKgs: estimateKgs
        })
        arr2.push({
          key: key2,
          lineuniquekey: lineuniquekey,
          estimateKgs: estimateKgs
        })

      }
      log.debug("arr1", arr1);
      log.debug("arr2", arr2);
      var data = mergeBy("key", arr1, arr2);
      log.debug("data", data);
      for (var i = 0; i < data.length; i++) {
        var lineNumber = rec.findSublistLineWithValue({
          sublistId: 'item',
          fieldId: 'lineuniquekey',
          value: data[i].lineuniquekey
        })
        if (lineNumber != -1) {
          log.debug("lineNumber", lineNumber)
          var estimateKgs = arr2.filter(x => x.key == data[i].key)

          if (estimateKgs.length > 0) {
            estimateKgs = estimateKgs[0].estimateKgs
          }
          else {
            estimateKgs = 0
          }
          log.debug("estimateKgs", estimateKgs);
          var estimateKgsUpdate = arr1.filter(x => x.key == data[i].key)
          log.debug("estimateKgsUpdate", estimateKgsUpdate);
          if (estimateKgsUpdate.length > 0) {
            var lineNumber = rec.findSublistLineWithValue({
              sublistId: 'item',
              fieldId: 'lineuniquekey',
              value: estimateKgsUpdate[0].lineuniquekey
            })
            if (lineNumber != -1) {
              rec.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ddc_estimated_kgs',
                line: lineNumber,
                value: estimateKgs
              })
            }
          }


        }
      }


      var recid = rec.save();
      log.debug("recid", recid)

    } catch (e) {
      log.debug("e", e)
    }
  };
  function mergeBy(key, dataL, dataR) {
    const rMap = dataR.reduce((m, o) => m.set(o[key], { ...m.get(o[key]), ...o }), new Map);

    return dataL.filter(x => rMap.get(x[key])).map(x => ({ ...x, ...rMap.get(x[key]) }));
  }

  return {

    afterSubmit: afterSubmit
  };
});