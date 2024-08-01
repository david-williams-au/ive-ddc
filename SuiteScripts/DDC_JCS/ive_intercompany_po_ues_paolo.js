/**
 *@NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @NAmdConfig /SuiteScripts/IVE Scripts/Modules/amdconfig.json
 */

/**
 * @deployedto Customer Invoice
 */

define([
  'N/record',
  'N/search',
  'N/runtime',
  'N/ui/message',
  './ddc_jcs_util.js',
  './ive_intercompany_po_util.js',
  'IVE/integration'
], function (
  _nRecord,
  _nSearch,
  _nRuntime,
  _nMessage,
  util,
  icutil,
  integration
) {

  /**
   * The number of lines in the intercompany journal entry
   * @constant {number}
   */
  const LINECOUNT = 4;

  /**
   * Executes before the page is loaded.
   * @param {Object} context - The context object.
   * @param {Record} context.newRecord - The new record.
   * @param {string} context.type - The context type (e.g., 'COPY', 'VIEW').
   * @param {Form} context.form - The current form.
   */
  function beforeLoad(context) {
    try {
      let newRecord = context.newRecord;

      // If the context type is COPY
      if (context.type === context.UserEventType.COPY) {
        newRecord.setValue({ fieldId: 'custbody_ive_ic_autobill_mult_po_found', value: ['0'] });
        newRecord.setValue({ fieldId: 'custbody_erp_po', value: '' });

        log.debug({
          title: 'beforeLoad',
          details: 'custbody_ive_ic_autobill_mult_po_found field cleared for copied record'
        });
      }

      if (context.type !== context.UserEventType.VIEW) {
        return; // Do nothing if not view mode
      }


      let multiPOFound = newRecord.getValue({ fieldId: 'custbody_ive_ic_autobill_mult_po_found' });
      log.debug("multiPOFound", multiPOFound)

      if (multiPOFound.length > 0) {
        let messageText = 'Multiple purchase orders with the same ERP PO# found. They must be billed manually. Ignore this message if already billed.';

        let alertMessage = _nMessage.create({
          title: 'Alert',
          message: messageText,
          type: _nMessage.Type.WARNING,
          duration: 10000
        });
        //alertMessage.show();

        context.form.addPageInitMessage({
          message: alertMessage
        });
      }
    } catch (ex) {
      log.error({
        title: 'Error in beforeLoad',
        details: ex
      });
    }
  }

  /**
   * Executes after the record is submitted.
   * @param {Object} context - The context object.
   * @param {Record} context.newRecord - The new record.
   * @param {string} context.type - The context type (e.g., 'create', 'edit').
   */
  function afterSubmit(context) {
    try {
      log.debug({ title: 'context.type', details: context.type });
      if (context.type != 'create') return; // do nothing

      log.debug('id', context.newRecord.id);
      let thisrec = _nRecord.load({
        type: 'invoice',
        id: context.newRecord.id,
        isDynamic: true,
      });

      let erpPO = thisrec.getValue({ fieldId: 'custbody_erp_po' });
      log.debug('erpPO', erpPO);
      let tranid = thisrec.getValue('tranid');
      log.debug('tranid', tranid);

      let invSubs = thisrec.getValue({ fieldId: 'subsidiary' });
      let invCust = thisrec.getValue({ fieldId: 'entity' });

      if (util.isEmpty(erpPO)) return true; // do nothing

      let poSearch = _nSearch.create({
        type: 'purchaseorder',
        filters: [
          ["custbody_erp_po", "isnotempty", ""],
          'AND',
          ["formulanumeric: CASE WHEN SUBSTR({custbody_erp_po}, 0, LENGTH({custbody_erp_po}) - 2) = '" + erpPO + "' THEN 1 ELSE 0 END", "equalto", "1"],
          'AND',
          ["status", "anyof", "PurchOrd:F", "PurchOrd:B"],
          'AND',
          ["mainline", "is", "T"],
          'AND',
          ["vendor.custentity_ive_ic_autobill_loan_acc", "noneof", "@NONE@"]
        ],
        columns: ['total',
          'custbody_ive_ic_autobill_tolerance_hi',
          'custbody_ive_ic_autobill_tolerance_low',
          'subsidiary',
          'entity',
          'custbody_ive_ic_autobill_invoices',
          'custbody_ive_ic_autobill_inv_total',
          _nSearch.createColumn({
            name: "custrecord_ive_ic_autobill_bank_account",
            join: "subsidiary",
            label: "IC Auto-Bill Bank Account"
          })
        ]
      }).run().getRange({ start: 0, end: 1000 });

      log.debug('poSearch.length', poSearch.length);
      if (poSearch.length === 0) {

        poSearch = _nSearch.create({
          type: 'purchaseorder',
          filters: [
            ["custbody_erp_po", "isempty", ""],
            'AND',
            ["tranid", "is", erpPO],
            'AND',
            ["status", "anyof", "PurchOrd:F", "PurchOrd:B"],
            'AND',
            ["mainline", "is", "T"],
            'AND',
            ["vendor.custentity_ive_ic_autobill_loan_acc", "noneof", "@NONE@"]
          ],
          columns: ['total',
            'custbody_ive_ic_autobill_tolerance_hi',
            'custbody_ive_ic_autobill_tolerance_low',
            'subsidiary',
            'entity',
            'custbody_ive_ic_autobill_invoices',
            'custbody_ive_ic_autobill_inv_total',
            _nSearch.createColumn({
              name: "custrecord_ive_ic_autobill_bank_account",
              join: "subsidiary",
              label: "IC Auto-Bill Bank Account"
            })
          ]
        }).run().getRange({ start: 0, end: 1000 });

        if (poSearch.length === 0) return true;

      }



      if (poSearch.length > 1) {
        let poIds = poSearch.map(function (result) {
          return result.id;
        });
        thisrec.setValue({ fieldId: 'custbody_ive_ic_autobill_mult_po_found', value: poIds });
        thisrec.save();
        return true; // do nothing
      }

      let cusLoanAcc = _nSearch.lookupFields({
        type: 'customer',
        id: invCust,
        columns: ['custentity_ive_ic_autobill_loan_acc']
      }).custentity_ive_ic_autobill_loan_acc[0].value;

      log.debug("cusLoanAcc", cusLoanAcc);

      if (util.isEmpty(cusLoanAcc)) return true; // do nothing

      let poResult = poSearch[0];
      let poID = poResult.id;
      let poTotal = parseFloat(poResult.getValue('total'));
      let toleranceHi = parseFloat(poResult.getValue('custbody_ive_ic_autobill_tolerance_hi'));
      let toleranceLow = parseFloat(poResult.getValue('custbody_ive_ic_autobill_tolerance_low'));
      let poInvTotal = parseFloat(poResult.getValue('custbody_ive_ic_autobill_inv_total')) || 0;
      log.debug("poInvTotal", poInvTotal);
      let invTotal = parseFloat(thisrec.getValue({ fieldId: 'total' }));

      invTotal = invTotal + poInvTotal;
      log.debug("invTotalFinal", invTotal);

      let vbSubs = poResult.getValue('subsidiary');
      let vbEntity = poResult.getValue('entity');
      let vbPayAcc = poResult.getValue({
        name: "custrecord_ive_ic_autobill_bank_account",
        join: "subsidiary",
        label: "IC Auto-Bill Bank Account"
      });
      let poInvoices = poResult.getValue('custbody_ive_ic_autobill_invoices');

      // GR - 2024-07-19 - For stage 1, multiple invoices are out of scope, so will be treated manually as an exception.
      let processWithException = false;
      // GR - 2024-07-19 - If the PO has already been invoiced, treat PO as exception.
      if (poInvoices) {
        processWithException = true;
      }

      log.debug("poInvoices", poInvoices);
      poInvoices = poInvoices ? poInvoices.split(',') : [];
      poInvoices.push(thisrec.id);
      log.debug("poInvoices2", poInvoices);


      // Add logging to see what we get for tolerance values
      log.debug('toleranceHi', toleranceHi);
      log.debug('toleranceLow', toleranceLow);

      _nRecord.submitFields({
        type: 'purchaseorder',
        id: poID,
        values: {
          'custbody_ive_ic_autobill_inv_total': invTotal,
          'custbody_ive_ic_autobill_invoices': poInvoices
        }
      });

      // GR - 2024-07-19 - If PO is to be treated as an exception, Exit after storing the latest Invoice and Total
      if (processWithException) {
        log.debug("PO has multiple Invoices so exit and treat as an exception");
        return true; // do nothing
      }

      // Check if PO total is equal to Invoice total
      if (poTotal !== invTotal && !isWithinTolerance(invTotal, toleranceHi, toleranceLow)) {

        _nRecord.submitFields({
          type: 'purchaseorder',
          id: poID,
          values: {
            'custbody_ive_ic_autobill_po_amt_mismat': true
          }
        });
        log.debug("amount doesn't matched");
        return true; // do nothing
      }

      _nRecord.submitFields({
        type: 'purchaseorder',
        id: poID,
        values: {
          'custbody_ive_ic_autobill_po_amt_mismat': false
        }
      });

      let vbID = CreateVB(poID, thisrec.id, tranid);
      if (util.isEmpty(vbID)) return true; // do nothing


      let params = {
        invID: thisrec.id,
        vbID: vbID,
        invTotal: invTotal,
        invSubs: invSubs,
        invCust: invCust,
        poTotal: poTotal,
        vbSubs: vbSubs,
        vbEntity: vbEntity
      };
      log.debug("params", params);

      //let LINECOUNT = (poInvoices.length + 2) * 2;

      let jeID = CreateJE(params);
      if (util.isEmpty(jeID)) return;

      _nRecord.submitFields({
        type: 'vendorbill',
        id: vbID,
        values: {
          'custbody_paired_je': jeID
        }
      });
      createBillPayment(vbID, jeID, poTotal, vbPayAcc);
      createInvoicePayment(poInvoices, jeID, invTotal);

      closePurchaseOrder(poID);

      integration.testMode = false;
      integration.requestFinanceRecordAction(integration.Actions.ADD, 'vendorbill', vbID);

      log.debug({
        title: 'afterSubmit',
        details: '--- end ---'
      });

    } catch (ex) {
      log.debug({
        title: 'afterSubmit ex',
        details: ex
      });
    }
  }

  /**
   * Creates a Vendor Bill from a Purchase Order.
   * @param {string} poID - The Purchase Order ID.
   * @param {string} invID - The Invoice ID.
   * @param {string} tranid - The transaction ID.
   * @returns {string|null} The Vendor Bill ID or null if an error occurs.
   */
  function CreateVB(poID, invID, tranid) {
    try {
      log.debug("tranid", tranid);
      let vendBill = _nRecord.transform({
        fromType: _nRecord.Type.PURCHASE_ORDER,
        fromId: poID,
        toType: _nRecord.Type.VENDOR_BILL,
        isDynamic: true,
      });

      vendBill.setValue({
        fieldId: 'tranid',
        value: tranid, // Set the Bill # to the Source Invoice’s Document #
        ignoreFieldChange: true
      });

      let vbID = vendBill.save();
      log.debug({
        title: 'vbID',
        details: vbID
      });
      return vbID;
    } catch (ex) {
      log.debug({
        title: 'CreateVB ex',
        details: ex
      });
      return null;
    }
  }

  /**
   * Creates an Intercompany Journal Entry.
   * @param {Object} params - The parameters for the Journal Entry.
   * @param {string} params.vbID - The Vendor Bill ID.
   * @param {number} params.invTotal - The Invoice total amount.
   * @param {number} params.invSubs - The Invoice subsidiary.
   * @param {number} params.invCust - The Invoice customer.
   * @param {number} params.poTotal - The Purchase Order total amount.
   * @returns {string|null} The Journal Entry ID or null if an error occurs.
   */
  function CreateJE(params) {
    try {
      let vbID = params.vbID;
      // let vbVals = _nSearch.lookupFields({
      //     type: _nRecord.Type.VENDOR_BILL,
      //     id: vbID,
      //     columns: ['subsidiary', 'entity']
      // });
      let objRecord = _nRecord.create({
        type: 'advintercompanyjournalentry',
        isDynamic: true
      });
      objRecord.setValue('custbody_paired_vendor_invoice', vbID);
      objRecord.setValue('subsidiary', params.vbSubs);
      objRecord.setValue('approvalstatus', '2');
      objRecord.setValue({
        fieldId: 'memo',
        value: 'IC Auto-Billing'
      });

      objRecord.setValue({
        fieldId: 'custbody_ive_ic_autobill_created_by',
        value: true
      });


      // params.vbSubs = vbVals.subsidiary[0].value;
      // params.vbEntity = vbVals.entity[0].value;

      for (let l = 1; l <= LINECOUNT; l++) {
        let lineobj = icutil.getLineValue(l, params);
        log.debug({
          title: 'lineobj' + l,
          details: lineobj
        });

        objRecord.selectNewLine({
          sublistId: 'line'
        });

        for (let key in lineobj) {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: key,
            value: lineobj[key],
            ignoreFieldChange: false
          });
        }

        objRecord.commitLine({
          sublistId: 'line'
        });
      }

      let jeID = objRecord.save();
      log.debug({
        title: 'success jeID',
        details: jeID
      });
      return jeID;

    } catch (ex) {
      log.debug({
        title: 'CreateJE ex',
        details: ex
      });
      return null;
    }
  }

  /**
   * Creates a Bill Payment for a Vendor Bill and Journal Entry.
   * @param {string} vbID - The Vendor Bill ID.
   * @param {string} jeID - The Journal Entry ID.
   * @param {number} poTotal - The Purchase Order total amount.
   */
  function createBillPayment(vbID, jeID, poTotal, vbPayAcc) {
    try {
      let vendPayment = _nRecord.transform({
        fromType: _nRecord.Type.VENDOR_BILL,
        fromId: vbID,
        toType: _nRecord.Type.VENDOR_PAYMENT,
        isDynamic: true,
      });

      vendPayment.setValue({
        fieldId: 'account',
        value: vbPayAcc
      });

      vendPayment.setValue({
        fieldId: 'memo',
        value: 'IC Auto-Billing'
      });

      vendPayment.setValue({
        fieldId: 'custbody_ive_ic_autobill_created_by',
        value: true
      });


      // Select the Vendor Bill
      let vbLineNumber = vendPayment.findSublistLineWithValue({
        sublistId: 'apply',
        fieldId: 'internalid',
        value: vbID
      });
      log.debug("vbLineNumber", vbLineNumber);
      if (vbLineNumber !== -1) {
        vendPayment.selectLine({
          sublistId: 'apply',
          line: vbLineNumber
        });
        vendPayment.setCurrentSublistValue({
          sublistId: 'apply',
          fieldId: 'apply',
          value: true
        });
        // vendPayment.setCurrentSublistValue({
        //     sublistId: 'apply',
        //     fieldId: 'amount',
        //     value: poTotal
        // });
        vendPayment.commitLine({
          sublistId: 'apply'
        });
      }

      // Select the Journal Entry
      let jeLineNumber = vendPayment.findSublistLineWithValue({
        sublistId: 'apply',
        fieldId: 'internalid',
        value: jeID
      });
      log.debug("jeLineNumber", jeLineNumber);
      if (jeLineNumber !== -1) {
        vendPayment.selectLine({
          sublistId: 'apply',
          line: jeLineNumber
        });
        vendPayment.setCurrentSublistValue({
          sublistId: 'apply',
          fieldId: 'apply',
          value: true
        });
        // vendPayment.setCurrentSublistValue({
        //     sublistId: 'apply',
        //     fieldId: 'amount',
        //     value: poTotal
        // });
        vendPayment.commitLine({
          sublistId: 'apply'
        });
      }



      let vendPaymentID = vendPayment.save();
      log.debug({
        title: 'Bill Payment Created',
        details: vendPaymentID
      });
    } catch (ex) {
      log.error({
        title: 'Error creating Bill Payment',
        details: ex
      });
    }
  }

  /**
   * Creates an Invoice Payment for an Invoice and Journal Entry.
   * @param {string} invID - The Invoice ID.
   * @param {string} jeID - The Journal Entry ID.
   * @param {number} invTotal - The Invoice total amount.
   */
  function createInvoicePayment(invIDArray, jeID, invTotal) {
    try {
      invIDArray.forEach(invIDs => {
        let custPayment = _nRecord.transform({
          fromType: _nRecord.Type.INVOICE,
          fromId: invIDs,
          toType: _nRecord.Type.CUSTOMER_PAYMENT,
          isDynamic: true,
        });

        custPayment.setValue({
          fieldId: 'undepfunds',
          value: 'T'
        });

        custPayment.setValue({
          fieldId: 'memo',
          value: 'IC Auto-Billing'
        });

        custPayment.setValue({
          fieldId: 'custbody_ive_ic_autobill_created_by',
          value: true
        });

        // Select the Invoice
        let invLineNumber = custPayment.findSublistLineWithValue({
          sublistId: 'apply',
          fieldId: 'internalid',
          value: invIDs
        });
        log.debug("invLineNumber", invLineNumber);
        if (invLineNumber !== -1) {
          custPayment.selectLine({
            sublistId: 'apply',
            line: invLineNumber
          });
          custPayment.setCurrentSublistValue({
            sublistId: 'apply',
            fieldId: 'apply',
            value: true
          });
          // custPayment.setCurrentSublistValue({
          //     sublistId: 'apply',
          //     fieldId: 'amount',
          //     value: invTotal
          // });
          custPayment.commitLine({
            sublistId: 'apply'
          });
        }

        // Select the Journal Entry
        let jeLineNumber = custPayment.findSublistLineWithValue({
          sublistId: 'credit',
          fieldId: 'internalid',
          value: jeID
        });
        log.debug("jeLineNumber", jeLineNumber);
        if (jeLineNumber !== -1) {
          custPayment.selectLine({
            sublistId: 'credit',
            line: jeLineNumber
          });
          custPayment.setCurrentSublistValue({
            sublistId: 'credit',
            fieldId: 'apply',
            value: true
          });
          // custPayment.setCurrentSublistValue({
          //     sublistId: 'apply',
          //     fieldId: 'amount',
          //     value: invTotal
          // });
          custPayment.commitLine({
            sublistId: 'credit'
          });
        }

        let custPaymentID = custPayment.save();
        log.debug({
          title: 'Invoice Payment Created',
          details: custPaymentID
        });
      });
    } catch (ex) {
      log.error({
        title: 'Error creating Invoice Payment',
        details: ex
      });
    }
  }


  /**
   * Checks if the invoice total is within the tolerance range.
   * @param {number} invTotal - The Invoice total amount.
   * @param {number} toleranceHi - The high tolerance limit.
   * @param {number} toleranceLow - The low tolerance limit.
   * @returns {boolean} True if within tolerance, false otherwise.
   */
  function isWithinTolerance(invTotal, toleranceHi, toleranceLow) {
    try {
      return invTotal <= toleranceHi && invTotal >= toleranceLow;
    } catch (e) {
      log.error("error in isWithinTolerance", e);
    }
  }

  /**
   * close the po if the status is pending receipt after billing.
   */
  function closePurchaseOrder(poID) {
    try {
      // Lookup the status of the purchase order
      let poStatus = _nSearch.lookupFields({
        type: 'purchaseorder',
        id: poID,
        columns: ['status']
      }).status[0].value;
      log.debug("poStatus", poStatus);

      // Check if the purchase order status is 'Pending Receipt'
      if (poStatus === 'pendingReceipt') {
        log.debug("inside if");

        // Load the purchase order record
        let poRecord = _nRecord.load({
          type: 'purchaseorder',
          id: poID
        });

        // Get the number of lines in the purchase order
        let lineCount = poRecord.getLineCount({
          sublistId: 'item'
        });

        // Iterate through each line and set isclosed to true
        for (let i = 0; i < lineCount; i++) {
          poRecord.setSublistValue({
            sublistId: 'item',
            fieldId: 'isclosed',
            line: i,
            value: true
          });
        }

        // Save the purchase order record
        poRecord.save();

        log.debug('Purchase order closed', poID);
      }
    } catch (e) {
      log.error('Error closing purchase order', e);
    }
  }



  return {
    beforeLoad: beforeLoad,
    afterSubmit: afterSubmit
  }
});