/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Purchase Order
 */

define(['N/runtime'], (runtime) => {

  // @since 2024-02-20
  // @author Paolo Ermani
  // @description FEATURE Extension of condition to exclude setting location field value to allow subsidiaries to be confiured

  //function beforeSubmit(context) {
  function beforeSubmit(scriptContext) {

    let context = 'beforeSubmit';

    // END FEATURE

    try {

      let rec = scriptContext.newRecord

      // @since 2024-02-20
      // @author Paolo Ermani
      // @description FEATURE Extension of condition to exclude setting location field value to allow subsidiaries to be confiured

      context += ':' + rec.getValue({ fieldId: 'tranid' });

      let script = runtime.getCurrentScript();
      let excludeParamValue = (script.getParameter({ name: 'custscript_custcol_sub_ue_excl_sub' }) || '').trim();
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
      //let isGroupOfficePo = (Number(rec.getValue({ fieldId: 'subsidiary' })) === 13);
      let exclude = (excludeSubIds.indexOf(Number(rec.getValue({ fieldId: 'subsidiary' }))) !== -1);

      log.debug(
        {
          title: context + ':' + 'exclude',
          details: exclude
        }
      );

      // END HOTFIX

      // END FEATURE

      let { type, id } = rec
      let lineCount = rec.getLineCount({ sublistId: 'item' })
      let execCtx = runtime.executionContext
      log.debug('>>>>', { type, id, eventType: scriptContext.type, execCtx, lineCount })

      for (let i = 0; i < lineCount; i++) {
        //////// COPY CUSTCOL TO STANDARD

        let custSub = rec.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_rec_sub',
          line: i
        })
        rec.setSublistValue({
          sublistId: 'item',
          fieldId: 'targetsubsidiary',
          line: i,
          value: custSub
        })

        let custLoc = rec.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_rec_loc',
          line: i
        })
        rec.setSublistValue({
          sublistId: 'item',
          fieldId: 'targetlocation',
          line: i,
          value: custLoc
        })

        // @since 2024-02-20
        // @author Paolo Ermani
        // @description FEATURE Extension of condition to exclude setting location field value to allow subsidiaries to be confiured

        // @since 2024-02-5 
        // @author Paolo Ermani
        // @description HOTFIX Added condition to exclude setting location field value for Group Office
        //if (!isGroupOfficePo) {
        if (!exclude) {

          // @since 2024-01-25
          // @author Paolo Ermani
          // @description Added setting of standard location line field to address issue with billing PO

          rec.setSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            line: i,
            value: custLoc
          });

          // END Added setting of standard location line field to address issue with billing PO

        }

        // END HOTFIX

        // END FEATURE

      }
    } catch (e) {
      //log.debug('Error beforeSubmit', e.message)
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