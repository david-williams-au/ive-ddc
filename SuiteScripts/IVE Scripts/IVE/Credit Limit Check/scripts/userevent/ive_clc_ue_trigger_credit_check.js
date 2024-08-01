/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NAmdConfig /SuiteScripts/IVE Scripts/Modules/amdconfig.json
 */

/**
 * @deployedto Customer Invoice
 */

define(
  [
    'N/record',
    'N/runtime',
    'N/search',
    'common',
    '../../modules/constants',
    '../../modules/accounts-receiveable'
  ],

  /**
   * @param{record} record
   * @param{runtime} runtime
   * @param{search} search
   * @param {CommonModule} common
   * @param {object} constants
   * @param {AccountsReceivableModule} ar
   */
  (
    record,
    runtime,
    search,
    common,
    constants,
    ar
  ) => {

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

      // INTENTIONALLY EMPTY - NOT USED

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

      // INTENTIONALLY EMPTY - NOT USED

    }

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    function afterSubmit(scriptContext) {

      try {

        common.startScript(scriptContext);

        common.enterContext('afterSubmit'); // afterSubmit

        common.logVal('debug', 'scriptContext.type', scriptContext.type);

        if (
          (
            (scriptContext.type !== scriptContext.UserEventType.CREATE) &&
            (scriptContext.type !== scriptContext.UserEventType.COPY)
          )
        ) {

          common.leaveContext(); // afterSubmit

          return;

        }

        let script = runtime.getCurrentScript();
        let triggerOnSubId =
          script.getParameter(
            {
              name: constants.SCRIPTS.CREDIT_CHECK_TRIGGER.PARAMS.SOURCE_TRANSACTION_SUBSIDIARY.ID
            }
          );

        common.logVal('debug', 'triggerOnSubId', triggerOnSubId);

        if (
          // isNaN(triggerOnSubId) ||
          // (triggerOnSubId === 0)
          (!util.isString(triggerOnSubId)) ||
          (triggerOnSubId.trim() === '')
        ) {

          // SOURCE TRANSACTION SUBSIDIARY field not set on the deployment record ?! Ignore

          common.logMsg('emergency', 'Ensure that the SOURCE TRANSACTION SUBSIDIARY field is set on the deployment record');

          return;

        }

        if (triggerOnSubId.indexOf(',') !== -1) {

          triggerOnSubId = triggerOnSubId.split(',');

          triggerOnSubId.forEach(
            (id, index) => {

              triggerOnSubId[index] = Number(id);

            }
          );

        } else {

          triggerOnSubId = Number(triggerOnSubId);

        }

        common.logVal('debug', 'triggerOnSubId', triggerOnSubId);

        let subsidiaryId =
          Number(
            scriptContext.newRecord.getValue(
              {
                fieldId: constants.RECORDS.TRANSACTIONS.INVOICE.FIELDS.SUBSIDIARY.ID
              }
            )
          );

        common.logVal('debug', 'subsidiaryId', subsidiaryId);

        if (
          isNaN(subsidiaryId) ||
          (subsidiaryId === 0)
        ) {

          // Something wrong / changed on the transaction record ?!

          common.logMsg('error', 'No subsidiary value on the transaction');

          return;

        }

        // Deployment Check : Should the script run for the subsidiary on this transaction ?

        if (Array.isArray(triggerOnSubId)) {

          if (triggerOnSubId.indexOf(subsidiaryId) === -1) {

            // Not for us so can ignore

            return;

          }

        } else {

          if (subsidiaryId !== triggerOnSubId) {

            // Not for us so can ignore

            return;

          }

        }

        let customerId =
          scriptContext.newRecord.getValue(
            {
              fieldId: constants.RECORDS.TRANSACTIONS.INVOICE.FIELDS.CUSTOMER.ID
            }
          );

        common.logVal('debug', 'customerId', customerId);

        // N.B. Using customer internal id to allow the script to be as quick as possible

        common.enterContext('custiid' + customerId); // customerId

        let creditLimit = ar.getCustomerCreditLimit(customerId);

        common.logVal('debug', 'creditLimit', creditLimit);

        if (creditLimit === null) {

          // Customer doesn't have a credit limit set so not triggering a request

          common.logMsg('audit', 'No credit limit set. Not initiating a credit limit check on customer');

          common.leaveContext(); // customerId
          common.leaveContext(); // afterSubmit

          return;

        } else if (creditLimit === false) {

          common.logMsg('error', 'Unable to get credit limit. Continuing');

        }

        let checkRequestRecord =
          record.create(
            {
              type: constants.RECORDS.CREDIT_CHECK_REQ.ID
            }
          );

        checkRequestRecord.setValue(
          {
            fieldId: constants.RECORDS.CREDIT_CHECK_REQ.FIELDS.CUSTOMER.ID,
            value: customerId
          }
        );

        checkRequestRecord.setValue(
          {
            fieldId: constants.RECORDS.CREDIT_CHECK_REQ.FIELDS.SOURCE_TRANSACTION.ID,
            value: scriptContext.newRecord.id
          }
        );

        checkRequestRecord.save();

        common.logMsg('audit', 'Initiated a credit limit check on customer');

      } catch (e) {

        common.logErr('emergency', e, 'Failed to initiate a credit limit check on customer');

      } finally {

        common.leaveContext(); // customerId
        common.leaveContext(); // afterSubmit

      }

    }

    return { afterSubmit };

  }
);