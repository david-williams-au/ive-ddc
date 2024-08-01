/**
 * @name:                                       add_prelim_button_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Thu Sep 22 2022 9:26:52 AM
 * Change Logs:
 * Date                          Author               Description
 * Thu Sep 22 2022 9:26:52 AM -- Patrick Lising -- Initial Creation
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Quote
 */

define(['N/currentRecord'], function (currentRecord) {

  function add_prelim_button_beforeLoad(context) {
    var currForm = context.form;
    var eventType = context.type;

    if (eventType == 'view') {

      var currentRec = context.newRecord;

      var subsidiary = currentRec.getValue('subsidiary');
      log.debug("subsidiary", subsidiary);
      //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
      if (subsidiary != '2') {
        return;
      }
      var recId = currentRec.id;
      var prelimProj = currentRec.getValue({
        fieldId: 'custbody_ddc_prelim_project'
      })

      log.debug({
        title: "recId",
        details: recId
      })

      log.debug({
        title: "prelimProj",
        details: "prelimProj val: " + prelimProj
      })

      if (!prelimProj) {

        currForm.clientScriptFileId = 322753; // SuiteScripts > JCS Project And Project Task > go_to_suitelet_cs.js

        currForm.addButton({
          id: 'custpage_create_prelim_proj',
          label: 'Create Prelim Project',
          functionName: 'goToSuitelet(' + recId + ')'
        });
      }
    }


  }



  return {
    beforeLoad: add_prelim_button_beforeLoad
  }
});