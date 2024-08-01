/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * @deployedto Requisition RFQ
 */

define(['N/record', 'N/search', 'N/format'], function (record, search, format) {

  function beforeLoad(context) {
    try {
      var form = context.form;
      if (context.type == 'view') {
        var newRecord = record.load({
          type: 'purchaserequisition',
          id: context.newRecord.id,
          isDynamic: true

        });
        var status = newRecord.getValue('status');
        log.debug("status", status);
        //var subsidiary=newRecord.getValue('custbody_bill_subsidiary');
        //if(!subsidiary){
        //    subsidiary = newRecord.getValue('subsidiary');
        //}
        //log.debug("subsidiary", subsidiary);
        //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
        var subsidiary = newRecord.getValue('subsidiary');
        if (subsidiary != '2') {
          return;
        }
        if (status == "Pending Order" && subsidiary == 2) {
          form.removeButton({
            id: 'createpo'
          })
        }
        var linkPO = newRecord.getValue('custbody_ddc_rfq_linked_po');
        log.debug("linkPO", linkPO);
        var rfqStatus = newRecord.getValue('custbody_ddc_rfq_status');
        log.debug("linkPO", linkPO);
        log.debug("rfqStatus", rfqStatus);
        if (linkPO && rfqStatus == 6) {
          return;
        }
        var suppplier1Ref = newRecord.getValue('custbody_ddc_rec_rfq_supplier1_pref');
        var suppplier2Ref = newRecord.getValue('custbody_ddc_rec_rfq_supplier2_pref');
        var suppplier3Ref = newRecord.getValue('custbody_ddc_rec_rfq_supplier3_pref');

        if (suppplier1Ref) {
          var vendor = newRecord.getValue('custbody_ddc_rfq_supplier1');
        }
        if (suppplier2Ref) {
          var vendor = newRecord.getValue('custbody_ddc_rfq_supplier2');
        }
        if (suppplier3Ref) {
          var vendor = newRecord.getValue('custbody_ddc_rfq_supplier3');
        }
        log.debug("vendor", vendor)

        if (status == 'Pending Order' && vendor && (suppplier1Ref || suppplier2Ref || suppplier3Ref)) {
          form.addButton({
            id: "custpage_create_po",
            label: 'Convert to PO',
            functionName: "generationPo()"
          });

          form.clientScriptModulePath = "SuiteScripts/JCS RFQ/create_purchase_order_cl.js";
        }


      }
    } catch (error) {
      log.debug("error", error)
    }

  }

  return {
    beforeLoad: beforeLoad,

  };
});