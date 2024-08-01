/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NAmdConfig /SuiteScripts/IVE Scripts/Modules/amdconfig.json
 */

/**
 * @deployedto Job
 */

define(
  [
    'N/record',
    'N/redirect',
    'N/runtime',
    'N/search',
    'common',
    'data',
    './modules/ive_cuf_constants'
  ],

  /**
* @param {record} record
* @param {redirect} redirect
* @param {runtime} runtime
* @param {search} search
* @param {CommonModule} common
* @param {object} data
* @param {object} constants
*/
  (
    record,
    redirect,
    runtime,
    search,
    common,
    data,
    constants
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

      try {

        common.startScript(scriptContext);

        let cfReqParam =
          (
            scriptContext
              .request
              .parameters[constants.REQUEST_PARAM_IDS.CHANGE_FORM] || false
          );
        let isEditMode = (scriptContext.type === scriptContext.UserEventType.EDIT);
        let isRunMode =
          (
            (scriptContext.type === scriptContext.UserEventType.EDIT) ||
            (scriptContext.type === scriptContext.UserEventType.VIEW)
          );

        let configId;
        let subsidiaryId;

        common.logVal('debug', 'isRunMode', isRunMode);

        if (!isRunMode) {

          common.logMsg('debug', 'Script execution stopped');

          return;

        }

        // if (common.user.roleScriptId === 'administrator') {

        //   if (cfReqParam !== false) {

        //     common.logMsg('audit', 'Allowing administrator to override form');

        //   } else {

        //     common.logMsg('audit', 'Administrator not overriding form');

        //   }

        //   common.logMsg('debug', 'Script execution stopped');

        //   return;

        // }

        // Retrieve the role => Form mapping

        subsidiaryId =
          Number(
            scriptContext.newRecord.getValue(
              {
                fieldId: constants.TRANSACTION.FIELD_IDS.SUBSIDIARY
              }
            )
          );

        common.logVal('debug', 'subsidiaryId', subsidiaryId);

        // TODO: Replace hack once script info properly exposed on common module
        // configId = common._script.getParameter({ name: constants.SCRIPT.PARAM_IDS.CONFIG });

        configSearch =
          search.create(
            {
              type: constants.CONFIG_RECORD.TYPE_ID,

              filters:
                [
                  {
                    name: constants.CONFIG_RECORD.FIELD_IDS.IS_INACTIVE,
                    operator: search.Operator.IS,
                    values:
                      [
                        'F'
                      ]
                  },

                  {
                    name: constants.CONFIG_RECORD.FIELD_IDS.SUBSIDIARY,
                    operator: search.Operator.ANYOF,
                    values:
                      [
                        subsidiaryId
                      ]
                  },

                  {
                    name: constants.CONFIG_RECORD.FIELD_IDS.USER_ROLE,
                    operator: search.Operator.ANYOF,
                    values:
                      [
                        common.user.role
                      ]
                  }
                ],

              columns:
                [
                  {
                    name: constants.CONFIG_RECORD.FIELD_IDS.FORM
                  }
                ]
            }
          );

        let mapping = data.getSearchResults(configSearch);

        common.logVal('debug', 'mapping', mapping);

        if (mapping === false) {

          throw new Error('Failed to load script config records');

        } else if (mapping.length === 0) {

          common.logMsg(
            'debug',
            'No script config records found for subsidiary: ' +
            subsidiaryId +
            ' and role: ' +
            common.user.roleScriptId

          );

          common.logMsg('debug', 'Script execution stopped');
          common.logMsg('audit', 'Form not changed');

          return;

        } else if (mapping.length > 1) {

          common.logMsg(
            'debug',
            'Multiple script config records found for subsidiary: ' +
            subsidiaryId +
            ' and role: ' +
            common.user.roleScriptId

          );

          throw new Error('Multiple script config records found');

        }

        formId = mapping[0][constants.CONFIG_RECORD.FIELD_IDS.FORM].value;

        common.logVal('debug', 'formId', formId);

        // Check if the request url already specifies a redirection to the
        // required form. If so then the script is finished

        if (
          (cfReqParam !== false) &&
          (cfReqParam === formId)
        ) {

          common.logMsg('audit', 'Form change not required');

          common.logMsg('debug', 'Script execution stopped');

          return;

        }

        // Send the user to view / edit using the specified form

        redirect.toRecord(
          {
            id: scriptContext.newRecord.id,
            type: scriptContext.newRecord.type,
            isEditMode: isEditMode,
            parameters:
            {
              cf: formId
            }
          }
        );

        common.logMsg('audit', 'Form changed');

      } catch (e) {

        common.logErr('emergency', e);

        common.logMsg('audit', 'Form not changed');

      }

    }

    /**
     * Defines the function definition that is executed before record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    // const beforeSubmit = (scriptContext) => {

    // }

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    // const afterSubmit = (scriptContext) => {

    // }

    // return { beforeLoad, beforeSubmit, afterSubmit }
    return { beforeLoad };

  }
);