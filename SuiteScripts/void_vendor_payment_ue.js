/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * @deployedto Journal Entry
 */

define(['N/record', './moment.js', 'N/search', 'N/format', 'N/email', 'N/runtime'], function (record, moment, search, format, email, runtime) {

  function afterSubmit(context) {
    try {
      log.debug("context type ", context.type)
      if (context.type != "create") {
        return;
      }
      var newRecord = context.newRecord;
      var transactionId = newRecord.id;
      var jeRec = record.load({
        type: "journalentry",
        id: transactionId,

      })
      var isJEVoid = jeRec.getValue({
        fieldId: 'void'
      });
      var totalJE = jeRec.getValue('custbody_sas_journal_total')
      var trandateJe = jeRec.getText('trandate');
      var subsidiary = jeRec.getValue('subsidiary');
      log.debug("isJEVoid", isJEVoid);
      if (isJEVoid || isJEVoid == 'T') {
        log.debug("doing some thing", "doing some thing");
        var createdfrom = jeRec.getValue('createdfrom')
        if (!createdfrom) {
          return;
        }
        var vendorPayment = record.load({
          type: "vendorpayment",
          id: createdfrom,

        })
        var creditAcc = vendorPayment.getValue("account");
        var sourseFile = vendorPayment.getValue('custbody_sftp_status_file_source')
        log.debug("creditAcc", creditAcc);

        var accountObj = record.load({
          type: 'account',
          id: creditAcc
        });
        var debitAccJE = accountObj.getValue('custrecord_eft_payt_clearing_acct');
        log.debug("debitAccJE", debitAccJE)

        var objRecord = record.create({
          type: 'journalentry',
          isDynamic: true,
          defaultValue: false
        });
        objRecord.setValue({
          fieldId: 'subsidiary',
          value: subsidiary
        })
        objRecord.setValue({
          fieldId: 'approvalstatus',
          value: 2
        })
        if (trandateJe) {
          trandateJe = format.parse({
            value: trandateJe,
            type: format.Type.DATE
          });

        }
        objRecord.setValue({
          fieldId: 'trandate',
          value: trandateJe
        })
        objRecord.selectNewLine({
          sublistId: 'line'
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: creditAcc
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'credit',
          value: totalJE
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'memo',
          value: sourseFile
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
          value: debitAccJE
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'debit',
          value: totalJE
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'memo',
          value: sourseFile
        })
        objRecord.commitLine({
          sublistId: 'line'
        })
        var recJe = objRecord.save();
        log.debug("new Je created ", recJe);

        var eftSumarised = vendorPayment.getValue('custbody_eft_summarised_jnl');
        vendorPayment.setValue('custbody_jcs_voided_sum_jnl', recJe);
        var vendorPaymentRec = vendorPayment.save();
        log.debug("vendorPaymentRec", vendorPaymentRec)
        if (!eftSumarised) {
          return;
        }
        var jeRecPm = record.load({
          type: "journalentry",
          id: eftSumarised,

        })
        var voidJe = jeRecPm.getValue('custbody_eft_voided_jnl_payt');
        log.debug("voidJe", voidJe)
        voidJe.push(transactionId);
        log.debug("voidJe dkm", voidJe);
        jeRecPm.setValue('custbody_eft_voided_jnl_payt', voidJe);
        var recJE = jeRecPm.save();
        log.debug("recJe", recJE);

      }


    } catch (e) {
      log.debug("e", e)
    }
  };

  return {
    afterSubmit: afterSubmit,

  };
});