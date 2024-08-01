/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * @deployedto Customer Invoice
 */

define([
  'N/record',
  'N/runtime',
  'N/url',
  'N/ui/serverWidget',
  'N/search',
  'N/format'
], function (record, runtime, url, serverWidget, search, format) {

  /**
   * Auto Create JE and auto Reverse JE
   * @param {object} context 
   * @param {string|object|*} context.type
   * @param {form} context.form
   * @param {request} context.request
   * @param {record} context.newRecord
   * @param {record} contextn.oldRecord
   */
  function afterSubmit(context) {
    var currentRecord = context.newRecord;
    try {
      if (context.type !== "create") {
        return;
      }
      var itemArr = [];
      var createdFrom = currentRecord.getValue('createdfrom');
      log.debug("createdFrom", createdFrom);
      if (!createdFrom) {
        return;
      }
      var invLocation = currentRecord.getValue('location');
      var invSubsidiary = currentRecord.getValue('subsidiary')
      log.debug("invSubsidiary", invSubsidiary);
      if (invSubsidiary != '2') {
        return;
      }
      var invRec = record.load({
        type: "invoice",
        id: currentRecord.id
      })
      var tranid = invRec.getValue('tranid');
      log.debug("tranid", tranid);
      var line = invRec.getLineCount('item');
      for (var i = 0; i < line; i++) {
        var itemtype = invRec.getSublistValue('item', 'itemtype', i);
        var itemId = parseInt(invRec.getSublistValue('item', 'item', i));
        var itemName = invRec.getSublistValue('item', 'item_display', i);
        var totalCost = parseFloat(invRec.getSublistValue('item', 'custcol_ddc_total_cost', i)) || 0;
        log.debug("totalCost", totalCost)
        if (totalCost == 0) {
          log.debug("skip this row", "skip this row");
          continue;
        }
        if (itemtype == 'Service') {
          var itemLookup = search.lookupFields({
            type: "item",
            id: itemId,
            columns: ['expenseaccount', 'custitem_ddc_cogs_account']
          })
          log.debug("itemLookup", itemLookup);
          var expenseAccount = itemLookup.expenseaccount;
          if (expenseAccount) {
            var expenseAcountNumber = expenseAccount[0].value;
          }
          var cogsAccount = itemLookup.custitem_ddc_cogs_account;
          if (cogsAccount) {
            var cogsAcountNumber = cogsAccount[0].value;
          }
          itemArr.push({
            itemId: itemId,
            itemName: itemName,
            totalCost: totalCost,
            expenseAcountNumber: expenseAcountNumber,
            cogsAcountNumber: cogsAcountNumber
          })

        }
      }
      log.debug("arr", itemArr);
      if (itemArr.length > 0) {
        var objRecord = record.create({
          type: 'journalentry',
          isDynamic: true,
          defaultValue: false
        });
        objRecord.setValue({
          fieldId: 'subsidiary',
          value: invSubsidiary
        })
        objRecord.setValue({
          fieldId: 'memo',
          value: "Automated Job Service Costing Journal for " + tranid
        });
        objRecord.setValue({
          fieldId: 'custbody_ddc_linked_invoice',
          value: currentRecord.id
        });

        // GR - 2023-11-03: auto-approve this journal - approvalstatus
        objRecord.setValue({
          fieldId: 'approvalstatus',
          value: 2
        });

        for (var i = 0; i < itemArr.length; i++) {
          objRecord.selectNewLine({
            sublistId: 'line'
          });
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'account',
            value: itemArr[i].expenseAcountNumber
          })
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'credit',
            value: itemArr[i].totalCost
          })
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'memo',
            value: itemArr[i].itemName
          })
          objRecord.commitLine({
            sublistId: 'line'
          })

          objRecord.selectNewLine({
            sublistId: 'line'
          });

          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'account',
            value: itemArr[i].cogsAcountNumber
          })
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'debit',
            value: itemArr[i].totalCost
          })
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'memo',
            value: itemArr[i].itemName
          })

          objRecord.commitLine({
            sublistId: 'line'
          })
        }
        var recJe = objRecord.save();
        if (recJe) {
          var invId = record.submitFields({
            type: 'invoice',
            id: currentRecord.id,
            values: {
              'custbody_ddc_linked_costing_journal': recJe
            },
            options: {
              enableSourcing: false,
              ignoreMandatoryFields: true
            }
          });
        }
      }



    } catch (err) {
      log.debug("error", err);
    }

  }



  return {

    afterSubmit: afterSubmit
  }
})