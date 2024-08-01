/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 *@NModuleScope Public
 */

/**
 * @deployedto Inventory Part
 * @deployedto Lot Numbered Inventory Item
 */

define([
  'N/record',
  'N/search',
  'N/task',
  './ddc_jcs_util.js'
],
  function (
    _nRecord,
    _nSearch,
    _nTask,
    util
  ) {
    var ReturnObj = {};
    const SUBSIDIARY = 2 //'IVE - Data Driven Communications';
    const COUNTSEARCH = 'customsearch_counter';
    const COUNTRECTYPE = 'customrecord_stock_counter';
    var prefix = 'IVE';

    // function afterSubmit(context) {
    //     try {
    //         log.debug({ title: 'context', details: context.type });
    //         // if (context.type != 'create') return;
    //         if (context.type == 'create' || context.type == 'copy') {
    //             var thisrec = context.newRecord;
    //             log.debug('thisrec',thisrec);
    //             thisrec = _nRecord.load({
    //                 type: thisrec.type,
    //                 id: thisrec.id,
    //                 //isDynamic: true,
    //             });

    //             var subs = thisrec.getValue({ fieldId: 'subsidiary' });
    //             // if (subs != SUBSIDIARY) return;
    //             if (!subs.includes('2')) return;
    //             var ddcStockCode = thisrec.getValue({ fieldId: 'custitem_ddc_stock_code' });
    //             log.debug("ddcStockCode", ddcStockCode);
    //             var displayname = thisrec.getValue({ fieldId: 'displayname' });
    //             log.debug("displayname", displayname);
    //             var itemIDValue = ddcStockCode + " - " + displayname;
    //             log.debug("itemIDValue", itemIDValue);
    //             var custOwned = thisrec.getValue({ fieldId: 'custitem_ddc_is_cust_owned' });//custitem_ive_item_customer_owned
    //             if (custOwned) {
    //                 //look up entityid
    //                 var custid = thisrec.getValue({ fieldId: 'custitem_ddc_owned_by_cust' });//custitem_ive_item_intended_customer
    //                 var custVals = util.lookupFields('CUSTOMER', custid, 'custentity_entity_code');
    //                 prefix = custVals.custentity_entity_code; //entityid
    //             }
    //             log.debug({
    //                 title: 'prefix',
    //                 details: prefix
    //             });
    //             var res = util.LoadSearch(COUNTSEARCH, null, null) //searchid, recordtype, filters

    //             var max = res[0].getValue({
    //                 name: 'custrecord_stock_count',
    //                 summary: 'MAX'
    //             });
    //             log.debug({
    //                 title: 'max',
    //                 details: max
    //             });

    //             if (isNaN(parseInt(max))) max = 0;
    //             var len = max.toString().length; var zeroes = '';

    //             log.debug({ title: 'prefix', details: prefix });
    //             while (len < 6) {
    //                 zeroes += '0';
    //                 len++;
    //             }
    //             max = parseInt(max);
    //             var maxStr = prefix.toString() + zeroes.toString() + (parseInt(max) + 1).toString();
    //             //GR ADD
    //             log.debug({
    //                 title: 'MaxStr',
    //                 details: maxStr
    //             });
    //             thisrec.setValue('itemid',itemIDValue);
    //             thisrec.setValue('custitem_ddc_stock_code',maxStr);
    //             // var recid=thisrec.save();
    //             // log.debug("recid",recid)
    //             // var id = _nRecord.submitFields({
    //             //     type: thisrec.type,
    //             //     id: thisrec.id,
    //             //     values: {
    //             //         itemid: itemIDValue,
    //             //         custitem_ddc_stock_code: maxStr

    //             //     },
    //             //     options: {
    //             //         enableSourcing: false,
    //             //         ignoreMandatoryFields: true
    //             //     }
    //             // });

    //             CreateRecordCount(thisrec.id, max);

    //             log.debug({
    //                 title: 'afterSubmit success',
    //                 details: 'maxStr: ' + maxStr
    //             });
    //         }
    //     } catch (ex) {
    //         log.debug({
    //             title: 'afterSubmit ex',
    //             details: ex
    //         });
    //     }
    // }

    function beforeSubmit(context) {
      try {
        log.debug({ title: 'context', details: context.type });
        // if (context.type != 'create') return;
        if (context.type == 'create' || context.type == 'copy') {
          var thisrec = context.newRecord;
          log.debug('thisrec', thisrec);
          var subs = thisrec.getValue({ fieldId: 'subsidiary' });
          // if (subs != SUBSIDIARY) return;
          if (!subs.includes('2')) return;
          var custOwned = thisrec.getValue({ fieldId: 'custitem_ddc_is_cust_owned' });//custitem_ive_item_customer_owned
          if (custOwned) {
            //look up entityid
            var custid = thisrec.getValue({ fieldId: 'custitem_ddc_owned_by_cust' });//custitem_ive_item_intended_customer
            var custVals = util.lookupFields('CUSTOMER', custid, 'custentity_entity_code');
            prefix = custVals.custentity_entity_code; //entityid
          }
          log.debug({
            title: 'prefix',
            details: prefix
          });
          var res = util.LoadSearch(COUNTSEARCH, null, null) //searchid, recordtype, filters

          var max = res[0].getValue({
            name: 'custrecord_stock_count',
            summary: 'MAX'
          });
          log.debug({
            title: 'max',
            details: max
          });

          if (isNaN(parseInt(max))) max = 0;
          var len = max.toString().length; var zeroes = '';

          log.debug({ title: 'prefix', details: prefix });
          while (len < 6) {
            zeroes += '0';
            len++;
          }
          max = parseInt(max);
          var maxStr = prefix.toString() + zeroes.toString() + (parseInt(max) + 1).toString();
          //GR ADD
          log.debug({
            title: 'MaxStr',
            details: maxStr
          });
          var displayname = thisrec.getValue({ fieldId: 'displayname' });
          log.debug("displayname", displayname);
          var itemIDValue = maxStr + " - " + displayname;
          log.debug("itemIDValue", itemIDValue);
          thisrec.setValue('itemid', itemIDValue);
          thisrec.setValue('custitem_ddc_stock_code', maxStr);
          CreateRecordCount(thisrec.id, max);

          log.debug({
            title: 'afterSubmit success',
            details: 'maxStr: ' + maxStr
          });
        }
      } catch (ex) {
        log.debug({
          title: 'afterSubmit ex',
          details: ex
        });
      }
    }
    function CreateRecordCount(itemid, val) {
      try {
        // Create a contact record
        var rec = _nRecord.create({
          type: COUNTRECTYPE,
          isDynamic: true
        });

        rec.setValue({
          fieldId: 'custrecord_stock_item',
          value: itemid,
          ignoreFieldChange: true
        });

        rec.setValue({
          fieldId: 'custrecord_stock_count',
          value: parseInt(val) + 1,
          ignoreFieldChange: true
        });

        var recordId = rec.save({
          enableSourcing: false,
          ignoreMandatoryFields: false
        });

        log.debug({
          title: 'CreateRecordCount created: ' + recordId,
          details: 'New Max Count: ' + parseInt(val) + 1
        });

      } catch (ex) {
        log.debug({
          title: 'CreateRecordCount ex',
          details: ex
        });
      }
    }


    //ReturnObj.afterSubmit = afterSubmit;
    ReturnObj.beforeSubmit = beforeSubmit;
    return ReturnObj;
  });