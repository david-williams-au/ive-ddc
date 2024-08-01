/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * @deployedto Run
 */

define(['N/currentRecord', 'N/email', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/format'],
  /**
   * @param {currentRecord} currentRecord
   * @param {email} email
   * @param {log} log
   * @param {record} record
   * @param {runtime} runtime
   * @param {search} search
   */
  function (currentRecord, email, log, record, runtime, search, format) {

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {
      log.debug("beforeLoad", beforeLoad);
      var tgType = scriptContext.type;
      var form = scriptContext.form;
      var currentRec = scriptContext.newRecord;
      var runStatus = currentRec.getValue({
        fieldId: "custrecord_ddc_run_status"
      })
      log.debug("runStatus", runStatus);
      if (tgType == 'view') {
        var isRunClone = isCheckRunningCloneMr(currentRec.id);
        log.debug("isRunClone", isRunClone);
        if (isRunClone) {
          return;
        }
      }
      if (tgType == 'view' && runStatus != '7') {
        form.addButton({
          id: "custpage_clone_run",
          label: 'Clone Run',
          functionName: "cloneRun"
        });
        form.addButton({
          id: "custpage_close_run",
          label: 'Cancel Run',
          functionName: "closeRun"
        });

        form.clientScriptModulePath = "SuiteScripts/Jcs Run Management/clone_run_cl.js";
      }


    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {
      log.debug("beforeSubmit", beforeSubmit);
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function isCheckRunningCloneMr(recordId) {
      log.debug("recordId", recordId);
      var scheduledscriptinstanceSearchObj = search.create({
        type: "scheduledscriptinstance",
        filters:
          [
            ["script.scriptid", "is", "customscript_jcs_clone_run_mr"],
            "AND",
            ["status", "anyof", "PENDING", "PROCESSING", "RESTART", "RETRY"],
            "AND",
            ["scriptdeployment.title", "is", "clone_run_" + recordId]
          ],
        columns:
          [
            search.createColumn({
              name: "datecreated",
              sort: search.Sort.ASC,
              label: "Date Created"
            }),
            search.createColumn({ name: "startdate", label: "Start Date" }),
            search.createColumn({ name: "enddate", label: "End Date" }),
            search.createColumn({ name: "queue", label: "Queue" }),
            search.createColumn({ name: "status", label: "Status" }),
            search.createColumn({ name: "mapreducestage", label: "Map/Reduce Stage" }),
            search.createColumn({ name: "percentcomplete", label: "Percent Complete" }),
            search.createColumn({ name: "queueposition", label: "Queue Position" })
          ]
      });
      var searchResultCount = scheduledscriptinstanceSearchObj.runPaged().count;
      log.debug("Check Running Clone Mr count", searchResultCount);
      scheduledscriptinstanceSearchObj.run().each(function (result) {
        log.debug("result", result)
        return true;
      });
      if (searchResultCount > 0) {
        return true;
      }
      else {
        return false;
      }

    }

    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit,

    };

  });