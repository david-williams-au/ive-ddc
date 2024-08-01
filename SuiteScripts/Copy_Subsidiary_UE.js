/**
 * Client : IVE GROUP
 * 
 * Description : Script will copy custcol_rec_sub value to duetofromsubsidiary through UI on vendor bill
 * 
 * Author : Mayur Savaliya
 * 
 * Created on : 6 Oct 2021
 * 
 */
/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Vendor Bill
 * @deployedto Vendor Credit
 */

define(['N/runtime'], (runtime) => {

  function beforeSubmit(scriptContext) {

    let context = 'beforeSubmit';

    try {
      let rec = scriptContext.newRecord

      context += ':' + rec.getValue({ fieldId: 'tranid' });

      let script = runtime.getCurrentScript();
      let excludeParamValue = (script.getParameter({ name: 'custscript_jcs_copy_subsidiary_ue_ex_sub' }) || '').trim();
      let excludeSubIds = [];

      log.debug(
        {
          title: context + ':' + 'excludeParamValue',
          details: excludeParamValue
        }
      );

      if (excludeParamValue.length > 0) {

        let ids = excludeParamValue.split(',');
        ids.forEach(
          (id) => {

            let _id = Number(id.trim());

            if (
              (!isNaN(_id)) &&
              (_id !== 0)
            ) {

              excludeSubIds.push(_id);

            } else {

              throw new Error('Invalid subsidiaries list');

            }
          }
        );

      }

      log.debug(
        {
          title: context + ':' + 'excludeSubIds',
          details: excludeSubIds
        }
      );

      // @since 2024-02-5 
      // @author Paolo Ermani
      // @description HOTFIX Added condition to exclude setting location field value for Group Office
      let exclude = (excludeSubIds.indexOf(Number(rec.getValue({ fieldId: 'subsidiary' }))) !== -1);

      log.debug(
        {
          title: context + ':' + 'exclude',
          details: exclude
        }
      );

      // END HOTFIX

      let { type, id } = rec
      let lineCount = rec.getLineCount({ sublistId: 'item' })
      let execCtx = runtime.executionContext
      log.debug(
        {
          title: context + ':' + 'rec',
          details: { type, id, eventType: scriptContext.type, execCtx, lineCount }
        }
      );

      for (let i = 0; i < lineCount; i++) {
        //////// COPY STANDARD TO CUSTCOL
        if (execCtx == runtime.ContextType.USER_INTERFACE) {
          let standardSub = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_rec_sub',
            line: i
          })
          rec.setSublistValue({
            sublistId: 'item',
            fieldId: 'duetofromsubsidiary',
            line: i,
            value: standardSub
          })

          // @since 2024-02-5 
          // @author Paolo Ermani
          // @description HOTFIX Added condition to exclude setting location field value for Group Office
          if (!exclude) {

            // @since 2024-01-25
            // @author Paolo Ermani
            // @description Added setting of standard location line field to address issue with billing PO

            let custLoc = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_rec_loc',
              line: i
            });

            rec.setSublistValue({
              sublistId: 'item',
              fieldId: 'location',
              line: i,
              value: custLoc
            });

            // END Added setting of standard location line field to address issue with billing PO

          }

          // END HOTFIX

        }
      }
    } catch (e) {
      log.error(
        {
          title: context,
          details: e
        }
      );
    }
  }

  return {
    beforeSubmit
  };
});