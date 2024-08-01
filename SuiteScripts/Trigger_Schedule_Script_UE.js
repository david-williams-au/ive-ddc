/**
* @NApiVersion 2.1
* @NScriptType UserEventScript
*/

/**
 * @deployedto Job
 */

define(['N/log', 'N/runtime', 'N/task', 'N/search'],
  /**
  * @param{log} log
  * @param{runtime} runtime
  * @param{task} task
  */
  (log, runtime, task, search) => {
    /**
    * Defines the function definition that is executed after record is submitted.
    * @param {Object} scriptContext
    * @param {Record} scriptContext.newRecord - New record
    * @param {Record} scriptContext.oldRecord - Old record
    * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
    * @since 2015.2
    */
    const afterSubmit = (scriptContext) => {
      let { oldRecord, newRecord } = scriptContext;
      let { type, id } = newRecord;
      //fetch parameter for run_creation_ue.js
      var subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });
      //var isRunCreated = newRecord.getValue({ fieldId: 'custbody_ddc_runs_created' });
      var productApprovalStatus = newRecord.getValue({ fieldId: 'custbody_ddc_production_approvalstatus' });
      /*if (isRunCreated) {
          return;
      }*/
      log.debug("subsidiary", subsidiary);
      if (subsidiary != '2') {
        return;
      }
      log.debug({
        title: 'prevent script',
        details: { custbody: newRecord.getValue({ fieldId: 'custbody_ddc_job_preventschscript' }) }
      })
      if (newRecord.getValue({ fieldId: 'custbody_ddc_job_preventschscript' }) == true) return;
      if (scriptContext.type == scriptContext.UserEventType.APPROVE) return;
      //#region 📜 Skip Job Locked Record from Web Services
      let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
      if (runtime.executionContext == runtime.ContextType.WEBSERVICES && custbody_ddc_job_locked) {
        return;
      }
      let jobNo = newRecord.getValue({ fieldId: 'custbody_ddc_job_no_without_prefix' })
      let executionContext = runtime.executionContext;
      /*let NewRecordlookupStatus = search.lookupFields({
          type: type,
          id: id,
          columns: ['status', 'statusref']
      });*/
      let status = {
        old: oldRecord ? oldRecord.getValue({ fieldId: 'status' }) : '',
        new: newRecord.getValue({ fieldId: 'status' })
      }
      let orderStatus = {
        old: oldRecord ? oldRecord.getValue({ fieldId: 'orderstatus' }) : '',
        new: newRecord.getValue({ fieldId: 'orderstatus' })
      }
      log.debug('------ [START] ------', { type, id, jobNo, eventType: scriptContext.type, executionContext, status, orderStatus })

      //fetch parameter for set_default_site_location_ue.js
      var user = runtime.getCurrentUser();
      log.debug("user", user);
      var locationEmp = user.location;
      log.debug("locationEmp", locationEmp);
      var userData = {
        user_subsidiary: user.subsidiary,
        user_internalid: user.id
      }
      try {
        //call the scheduled script and pass parameters
        //1. parameter for run_creation_ue.js
        //productApprovalStatus
        //Type
        //id
        //jobNo
        //status
        //orderStatus
        //scriptContext.type

        //2. parameter for set_default_site_location_ue.js
        //locationEmp
        log.debug({
          title: 'Trigger_Schedule_Script_UE.js',
          details: 'Script started'
        });

        const scriptTask = task.create({
          taskType: task.TaskType.SCHEDULED_SCRIPT,
          scriptId: 'customscript_trigger_jobprcoptimised_ss',
          params: {
            custscript_triggerjob_proc_optm_param: {
              productApprovalStatus,
              type,
              id,
              jobNo,
              status,
              orderStatus,
              scriptContextType: scriptContext.type,
              locationEmp,
              userData,
              custscript_jcs_sbsdry_fltrng: 2,//2 - IVE Group Limited : IVE Group Australia Pty Ltd : IVE - Data Driven Communications
              custscript_jcs_usr_fltrng: 4842, //system Account
              custscript_jcs_pwc_grip: 12.5,
              custscript_jcs_pwc_bleed_width: 3,
              custscript_jcs_pwc_bleed_height: 13,
              custscript_jcs_pwc_waste_run_per: 10,
              custscript_jcs_pwc_item_stock_type: 27, // 'Paper-Reel',
              executionContext
            }
          }
        });

        const scriptTaskId = scriptTask.submit();

        log.debug({
          title: 'Trigger_Schedule_Script_UE.js',
          details: `Script task submitted with id: ${scriptTaskId}`
        });

      } catch (error) {
        log.error('Error', error)
      }
    }

    return { afterSubmit }

  });