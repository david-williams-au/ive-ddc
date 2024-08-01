/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NAmdConfig /SuiteScripts/IVE Scripts/Modules/amdconfig.json
 */

/**
 * @deployedto Customer
 */

define(
  [
    'N/record',
    'N/search',
    'common'
  ],

  (
    record,
    search,
    common) => {

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

      // INTENTIONALLY LEFT EMPTY

    }

    /**
     * Defines the function definition that is executed before record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    function beforeSubmit(scriptContext) {

      // INTENTIONALLY LEFT EMPTY

    }

    /**
     * Copies the value from the External Id 2 field to the External Id field when a new customer is being created for the Print NSW or Print VIC subsidiaries
     *
     * N.B. The afterSubmit triggger was used because:
     * * NetSuite currently doesn't save changes to the externalid field in the beforeSubmit trigger
     * * the externalid field is used only for CSV importing of customers by administrators. The integrations use the value in the custentity_external_id_2 custom field instead
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    function afterSubmit(scriptContext) {

      try {

        common.enterContext('afterSubmit'); // Function

        common.startScript(scriptContext);

        common.logVal('debug', 'scriptContext.type', scriptContext.type);

        if (scriptContext.type !== scriptContext.UserEventType.CREATE) {

          common.logMsg('debug', 'Finished - Not create mode');

          return;

        }

        let subsidiaryId =
          scriptContext.newRecord.getValue(
            {
              fieldId: 'subsidiary'
            }
          );

        common.logVal('debug', 'subsidiaryId', subsidiaryId);

        let subsidiary =
          search.lookupFields(
            {
              type: search.Type.SUBSIDIARY,
              id: subsidiaryId,
              columns:
                [
                  'name'
                ]
            }
          )['name'];

        let externalId2 =
          scriptContext.newRecord.getValue(
            {
              fieldId: 'custentity_external_id_2'
            }
          );

        common.logVal('debug', 'subsidiary', subsidiary);
        common.logVal('debug', 'externalId2', externalId2);


        if (
          (subsidiary === 'IVE Group Limited : IVE Group Australia Pty Ltd : IVE - Print NSW') ||
          (subsidiary === 'IVE Group Limited : IVE Group Australia Pty Ltd : IVE - Print VIC')
        ) {

          common.logMsg('debug', 'Checking if there is a value for EXTERNAL ID2');

          if (
            !util.isString(externalId2) ||
            (externalId2.trim() === '')
          ) {

            // TODO Change this handling to redirect the user back to the record with an error message

            throw new Error('A value is required in the EXTERNAL ID2 field for the NetSuite to Prism integration');

          }

          // Bad practice but sadly the only way to achieve changing of the externalid field value

          record.submitFields(
            {
              type: scriptContext.newRecord.type,
              id: scriptContext.newRecord.id,
              values:
              {
                externalid: externalId2
              }
            }
          );

          common.logMsg('debug', 'Copied value from EXTERNAL ID 2 field to externalid');

        } else {

          // Not a Print NSW / VIC customer

          common.logMsg('debug', 'Finished - Not a Print NSW / VIC customer');

        }

      } catch (e) {

        common.logErr('error', e);

      }

      common.logMsg('debug', 'Finished');

      common.leaveContext(); // Function

    }

    return { afterSubmit };

  }
);