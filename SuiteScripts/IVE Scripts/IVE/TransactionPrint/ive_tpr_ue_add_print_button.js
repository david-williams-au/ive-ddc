/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NAmdConfig /SuiteScripts/IVE Scripts/Modules/amdconfig.json
 */

/**
 * @deployedto Credit Memo
 * @deployedto Customer Invoice
 * @deployedto Purchase Order
 * @deployedto Quote
 * @deployedto Vendor Prepayment
 */

define(
  [
    'N/render',
    'N/ui/serverWidget',
    'common'
  ],

  /**
   * @param {render} render
   * @param {serverWidget} serverWidget
   * @param {CommonModule} common
   */
  (
    render,
    serverWidget,
    common
  ) => {
    const CLIENT_SCRIPT_MODULE_PATH = './ive_tpr_cs_launch_print.js';

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
      try {
        common.startScript(scriptContext);

        if (!scriptContext.form) {
          return;
        }

        if (scriptContext.type !== scriptContext.UserEventType.VIEW) {
          return;
        }

        scriptContext.form.clientScriptModulePath = CLIENT_SCRIPT_MODULE_PATH;
        scriptContext.form.addButton(
          {
            id: 'custpage_transaction_print',
            label: 'Download',
            functionName: 'printTransaction'
          }
        );

        // Error to test error handling
        // throw new Error('Test Error');

        common.logMsg('audit', 'Print Transaction button added to the form');
      } catch (e) {
        common.logMsg('emergency', 'Print Transaction button could not be added to the form');
        common.logVal('emergency', 'Error', e);
      }
    }

    return { beforeLoad };
  }
);