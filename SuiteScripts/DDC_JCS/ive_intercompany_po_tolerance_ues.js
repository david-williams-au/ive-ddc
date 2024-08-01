/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 *@NModuleScope Public
 */

/**
 * @deployedto Purchase Order
 */

define(['N/record', 'N/log', 'N/runtime'], function (_nRecord, _nLog, _nRuntime) {
  /**
 * Executes before loading a purchase order record.
 * Clears the tolerance fields if the record is being copied.
 * @param {Object} context - Object containing the script execution context
 * @param {string} context.type - Trigger type: create, edit, copy
 * @param {Record} context.newRecord - New purchase order record
 */
  function beforeLoad(context) {
    try {
      let purchaseOrder = context.newRecord;

      if (context.type === 'copy') {
        purchaseOrder.setValue({ fieldId: 'custbody_ive_ic_autobill_invoices', value: ['0'] });
        purchaseOrder.setValue({ fieldId: 'custbody_ive_ic_autobill_tolerance', value: '' });
        purchaseOrder.setValue({ fieldId: 'custbody_ive_ic_autobill_tolerance_hi', value: '' });
        purchaseOrder.setValue({ fieldId: 'custbody_ive_ic_autobill_tolerance_low', value: '' });
        purchaseOrder.setValue({ fieldId: 'custbody_ive_ic_autobill_inv_total', value: '' });
        purchaseOrder.setValue({ fieldId: 'custbody_erp_po', value: '' });
        purchaseOrder.setValue({ fieldId: 'custbody_ive_ic_autobill_po_amt_mismat', value: '' });

        _nLog.debug({
          title: 'beforeLoad',
          details: 'Fields cleared for copied record'
        });
      }
    } catch (ex) {
      _nLog.error({
        title: 'Error in beforeLoad',
        details: ex
      });
    }
  }

  /**
   * Executes before submitting a purchase order record.
   * Updates the tolerance fields based on the total and tolerance value.
   * @param {Object} context - Object containing the script execution context
   * @param {string} context.type - Trigger type: create, edit
   * @param {Record} context.newRecord - New purchase order record
   */
  function beforeSubmit(context) {
    try {
      if (context.type !== 'create') return;

      let purchaseOrder = context.newRecord;
      let poTotal = parseFloat(purchaseOrder.getValue('total'));
      let toleranceValue = _nRuntime.getCurrentScript().getParameter({ name: 'custscript_ive_ic_autobill_tolerance' });
      log.debug("toleranceValue", toleranceValue);

      if (!toleranceValue) return;

      let toleranceRange = calculateToleranceRange(poTotal, toleranceValue);

      purchaseOrder.setValue({
        fieldId: 'custbody_ive_ic_autobill_tolerance',
        value: toleranceValue
      });


      purchaseOrder.setValue({
        fieldId: 'custbody_ive_ic_autobill_tolerance_hi',
        value: toleranceRange.above
      });
      purchaseOrder.setValue({
        fieldId: 'custbody_ive_ic_autobill_tolerance_low',
        value: toleranceRange.below
      });

      _nLog.debug({
        title: 'beforeSubmit',
        details: 'Upper and lower limits updated successfully'
      });
    } catch (ex) {
      _nLog.error({
        title: 'Error in beforeSubmit',
        details: ex
      });
    }
  }

  /**
   * Calculates the tolerance range based on the purchase order total and tolerance value.
   * @param {number} poTotal - Purchase order total
   * @param {string} toleranceValue - Tolerance value (can be percentage or dollar amount)
   * @returns {{above: number, below: number}} - Tolerance range (above and below limits)
   */

  function calculateToleranceRange(poTotal, toleranceValue) {
    let above, below;
    try {
      if (toleranceValue.indexOf('%') !== -1) {
        let percentageTolerance = parseFloat(toleranceValue) / 100;
        above = poTotal * (1 + percentageTolerance); // Upper limit: PO total + percentage tolerance
        below = poTotal * (1 - percentageTolerance); // Lower limit: PO total - percentage tolerance
      } else {
        let dollarTolerance = parseFloat(toleranceValue);
        above = poTotal + dollarTolerance; // Upper limit: PO total + dollar tolerance
        below = poTotal - dollarTolerance; // Lower limit: PO total - dollar tolerance
      }
      return { above: above, below: below };
    } catch (e) {
      _nLog.error("Error in calculateToleranceRange", e);
      return { above: poTotal, below: poTotal }; // Return the original PO total if there's an error
    }
  }

  return {
    beforeSubmit: beforeSubmit,
    beforeLoad: beforeLoad
  };
});