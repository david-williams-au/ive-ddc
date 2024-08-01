/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * @deployedto Job
 * @deployedto Quote
 */

define(['N/currentRecord', 'N/email', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/format', '../lib/ns.utils'],
  /**
   * @param {currentRecord} currentRecord
   * @param {email} email
   * @param {log} log
   * @param {record} record
   * @param {runtime} runtime
   * @param {search} search
   */
  function (currentRecord, email, log, record, runtime, search, format, ns_utils) {

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
      log.debug("runtime.executionContext", runtime.executionContext);
      // if (runtime.executionContext == runtime.ContextType.USER_INTERFACE) {
      //     return;
      // }
      //work around mapping by item and description
      // if(scriptContext.type=="edit"){
      //    try {
      //     log.debug("edit","edit");
      //     var newRec = scriptContext.newRecord;
      //     var oldRec = scriptContext.oldRecord;

      //     var subsidary = newRec.getValue('subsidiary');
      //     var bodySite = newRec.getValue('custbody_ddc_site');
      //     var bodyLocation = newRec.getValue('location')
      //     if (subsidary != '2') {
      //         return;
      //     }
      //     var oldLineCount = oldRec.getLineCount({
      //         sublistId: 'item'
      //     })
      //     var objectOldMapping={};
      //     for(var i=0;i<oldLineCount;i++){
      //         var item=oldRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
      //         var description=oldRec.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });
      //         var location=oldRec.getSublistValue({ sublistId: 'item', fieldId: 'location', line: i });
      //         var site=oldRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', line: i });
      //         objectOldMapping[item+"_"+description]=[location,site]
      //     }
      //     log.debug("objectOldMapping",objectOldMapping);
      //     var newLineCount = newRec.getLineCount({
      //         sublistId: 'item'
      //     })
      //     for(var i=0;i<newLineCount;i++){
      //         var item=newRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
      //         var description=newRec.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });
      //         newRec.setSublistValue({ sublistId: 'item', fieldId: 'location', value:bodyLocation, line: i });
      //         newRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', value:bodySite, line: i });
      //         if(objectOldMapping[item+"_"+description]){
      //             newRec.setSublistValue({ sublistId: 'item', fieldId: 'location', value:objectOldMapping[item+"_"+description][0], line: i });
      //             newRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', value:objectOldMapping[item+"_"+description][1], line: i });
      //         }

      //     }
      //    } catch (error) {
      //     log.debug("error",error)
      //    }
      // }

      //March 2023, as per FC, only set work center to default during create context or saved by SCPQ (context: SUITELET)
      // if (runtime.executionContext == runtime.ContextType.USER_INTERFACE) {
      //     if (scriptContext.type == "edit") {
      //         try {
      //             var newRec = scriptContext.newRecord;
      //             //newRec.setValue('customform',187)
      //             var oldRec = scriptContext.oldRecord;
      //             log.debug("oldRec", oldRec);
      //             var subsidary = newRec.getValue('subsidiary');
      //             if (subsidary != '2') {
      //                 return;
      //             }
      //             var bodySite = newRec.getValue('custbody_ddc_site');
      //             var bodyLocation = newRec.getValue('location')
      //             var bodySiteOld = oldRec.getValue('custbody_ddc_site');
      //             var bodyLocationOld = oldRec.getValue('location');
      //             var newLineCount = newRec.getLineCount({
      //                 sublistId: 'item'
      //             })

      //             if (bodySite != bodySiteOld) {
      //                 for (var i = 0; i < newLineCount; i++) {
      //                     newRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', value: bodySite, line: i })
      //                 }
      //             }
      //             if (bodyLocation != bodyLocationOld) {
      //                 for (var i = 0; i < newLineCount; i++) {
      //                     newRec.setSublistValue({ sublistId: 'item', fieldId: 'location', value: bodyLocation, line: i });
      //                     newRec.setSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: bodyLocation, line: i });

      //                 }
      //             }
      //             else {
      //                 for (var i = 0; i < newLineCount; i++) {
      //                     var location = newRec.getSublistValue({ sublistId: 'item', fieldId: 'location', line: i });
      //                     newRec.setSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: location, line: i });

      //                 }
      //             }


      //             populateWorkCentreLines(newRec)
      //         } catch (error) {
      //             log.debug("error", error)
      //         }

      //     }
      // }


      //// GR - 2024-02-23 - No need for this piece to have SUITELET context only. Removing condition. Adding specific sync for line Loc and line InvLoc.
      //as per FC, only set work center to default during save by SCPQ (context: SUITELET)
      ////       if (runtime.executionContext == 'SUITELET') {
      ////           log.debug("runtime.executionContext", 'SUITELET');
      //if (runtime.executionContext == 'SUITELET' || (runtime.executionContext == runtime.ContextType.USER_INTERFACE && scriptContext.type == "create")) {
      try {

        var newRec = scriptContext.newRecord;
        var subsidary = newRec.getValue('subsidiary');
        if (subsidary != '2') {
          return;
        }
        var bodySite = newRec.getValue('custbody_ddc_site');
        var bodyLocation = newRec.getValue('location');

        //// Start GR - Added - 2024-03-06 - Adding code to cater for when Body Site and/or Location are empty
        if (!bodySite || !bodyLocation) {

          //fetch Employee Location value
          var user = runtime.getCurrentUser();
          log.debug("user", user);
          var locationEmp = user.location;
          log.debug("locationEmp", locationEmp);
          if (!locationEmp) {
            return;
          }
          // Lookup custom record to fetch body site and body location
          if (locationEmp) {
            var empMapping = getLocationMapping((locationEmp).toString())
            if (empMapping.length > 0) {
              // set body Site and body Location and body Production Location
              newRec.setValue('location', empMapping[0].location)
              newRec.setValue('custbody_ddc_production_loc_filtered', empMapping[0].location)
              newRec.setValue('custbody_ddc_site', empMapping[0].site)
              var lineNumber = newRec.getLineCount('item');
              for (var i = 0; i < lineNumber; i++) {
                newRec.setSublistValue({ sublistId: 'item', fieldId: 'location', value: empMapping[0].location, line: i });
                newRec.setSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: empMapping[0].location, line: i });
                newRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', value: empMapping[0].site, line: i });
              }
            }
          }
          //// End GR - Added - 2024-03-06 - Adding code to cater for when Body Site and/or Location are empty
        } else {




          var newLineCount = newRec.getLineCount({
            sublistId: 'item'
          })

          for (var i = 0; i < newLineCount; i++) {
            var locationLine = newRec.getSublistValue({ sublistId: 'item', fieldId: 'location', line: i });
            log.debug(`locationline ${i}`, locationLine);
            if (!locationLine) {
              newRec.setSublistValue({ sublistId: 'item', fieldId: 'location', value: bodyLocation, line: i });
              newRec.setSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: bodyLocation, line: i });
              log.emergency({
                title: `check location values ${i}`,
                details:
                {
                  location: newRec.getSublistValue({ sublistId: 'item', fieldId: 'location', line: i }),
                  inventorylocation: newRec.getSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', line: i })
                }
              });
            }

            ////
            var invLocationLine = newRec.getSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', line: i });
            log.debug(`invLocationLine ${i}`, invLocationLine);
            if (!invLocationLine) {
              newRec.setSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: locationLine, line: i });
            }
            ////                      


            var siteLine = newRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', line: i });
            log.debug(`siteLine ${i}`, siteLine);
            if (!siteLine) {
              newRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', value: bodySite, line: i })

            }
          }
        }
        populateWorkCentreLines(newRec)
      } catch (error) {
        log.debug("error", error)
      }
      ////       }
      //old requirement
      // var user = runtime.getCurrentUser();
      // log.debug("user", user);
      // var empLookup = search.lookupFields({
      //     type: record.Type.EMPLOYEE,
      //     id: user.id,
      //     columns: ['location']
      // })
      // log.debug("empLookup", empLookup);
      // if (empLookup.location.length > 0) {
      //     var empMapping = getLocationMapping((empLookup.location[0].value).toString())
      //     if(empMapping.length>0){
      //         currentRecord.setValue('custbody_ddc_site', empMapping[0].site)
      //         currentRecord.setValue('location', empMapping[0].location)
      //         var lineNumber = currentRecord.getLineCount('item');
      //         for (var i = 0; i < lineNumber; i++) {
      //             currentRecord.setSublistValue({ sublistId: 'item', fieldId: 'location', value: empMapping[0].location, line: i });
      //             currentRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_site', value: empMapping[0].site, line: i });
      //         }
      //     }


      // }


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

    function getLocationMapping(locationID) {
      var ret = [];
      var empLocationSearch = search.create({
        type: 'customrecord_ddc_employee_site_loc_map',
        filters: [
          ['custrecord_ddc_eslm_emp_loc', 'anyof', locationID],
        ],
        columns:
          [
            search.createColumn({ name: "custrecord_ddc_eslm_site", label: "Site" }),
            search.createColumn({ name: "custrecord_ddc_eslm_location", label: "Production Location" })
          ]
      })
      empLocationSearch.run().each(each => {
        var site = parseInt(each.getValue('custrecord_ddc_eslm_site'));
        var location = parseInt(each.getValue('custrecord_ddc_eslm_location'))
        ret.push({
          site: site,
          location: location
        })

      })
      return ret;
    }

    // Added by lc 12122022
    const populateWorkCentreLines = rec => {
      let lineCount = rec.getLineCount({ sublistId: "item" })
      let siteAndWCGs = []

      for (let i = 0; i < lineCount; i++) {
        let siteSub = rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_site", line: i })
        let workCentreGroup = rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_work_centre_group", line: i })

        if (siteSub && workCentreGroup) {
          siteAndWCGs.push({
            site: siteSub,
            wcg: workCentreGroup
          })
        }
      }

      log.debug("populateWorkCentreLines siteAndWCGs", siteAndWCGs)

      let xFilters = []

      for (siteAndWCG of siteAndWCGs) {
        xFilters.push([
          ["custrecord_ddc_wcl_work_centre_group", "is", siteAndWCG.wcg],
          "AND",
          ["custrecord_ddc_wcl_site", "is", siteAndWCG.site],
          "AND",
          ["custrecord_ddc_wcl_default_at_site", "is", "T"]
        ])
        xFilters.push("OR")
      }
      xFilters.pop()

      log.debug("populateWorkCentreLines xFilters", xFilters)

      let wcg = search.create({
        type: "customrecord_ddc_work_centre",
        filters: xFilters,
        columns: [
          "custrecord_ddc_wcl_work_centre_group",
          "custrecord_ddc_wcl_site",
          "custrecord_ddc_wcl_machine",
          "custrecord_ddc_wcl_default_sched_seq",
          "custrecord_ddc_wcl_machine",
          "custrecord_ddc_wcl_machine_hour_rate",
          "custrecord_ddc_wcl_labour_rate",
          "custrecord_ddc_wcl_labour_oh_rate",
        ]
      })

      wcg = ns_utils.expandSearch(wcg)
      log.debug("populateWorkCentreLines wcg result", wcg)
      log.debug("populateWorkCentreLines wcg result", wcg.length)

      for (let i = 0; i < lineCount; i++) {
        let siteSub = rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_site", line: i })
        let workCentreGroup = rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_work_centre_group", line: i })
        if (!siteSub || !workCentreGroup) {
          continue;
        }
        let idx = wcg.findIndex(fi => fi.getValue({ name: "custrecord_ddc_wcl_site" }) == siteSub && fi.getValue({ name: "custrecord_ddc_wcl_work_centre_group" }) == workCentreGroup)

        if (idx == -1) {
          rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', value: '', line: i })
          rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine', value: '', line: i })
        } else {
          log.debug("setSublistValue", { i, siteSub, workCentreGroup, idx, wcg })

          rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_work_centre', value: wcg[idx].id, line: i });
          rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ddc_planned_machine', value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_machine" }), line: i })

          // Populate work centre fields

          let labourHoursRate = parseFloatOrZero(rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_hour_rate", line: i })) || wcg[idx].getValue({ name: "custrecord_ddc_wcl_labour_rate" })
          let labourOhRate = parseFloatOrZero(rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_oh_rate", line: i })) || wcg[idx].getValue({ name: "custrecord_ddc_wcl_labour_oh_rate" })
          let machineHourRate = parseFloatOrZero(rec.getSublistValue({ sublistId: "item", fieldId: "custcol_ddc_machine_hour_rate", line: i })) || wcg[idx].getValue({ name: "custrecord_ddc_wcl_machine_hour_rate" })
          log.debug("labourHoursRate", 'labourHoursRate: ' + labourHoursRate + ' || machineHourRate: ' + machineHourRate + ' || labourOhRate: ' + labourOhRate)

          rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_schedule_sequence", value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_default_sched_seq" }), line: i })
          rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_machine_hour_rate", value: machineHourRate, line: i })
          rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_hour_rate", value: labourHoursRate, line: i })
          rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_oh_rate", value: labourOhRate, line: i })


          // if (!labourHoursRate && !labourOhRate && !machineHourRate) {
          //     log.debug("!labourHours", 'set default work center fields')
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_schedule_sequence", value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_default_sched_seq" }), line: i })
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_machine_hour_rate", value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_machine_hour_rate" }), line: i })
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_hour_rate", value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_labour_rate" }), line: i })
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_oh_rate", value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_labour_oh_rate" }), line: i })
          // } else {
          //     log.debug("!labourHours", 'set default work center fields value from scpq')
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_schedule_sequence", value: wcg[idx].getValue({ name: "custrecord_ddc_wcl_default_sched_seq" }), line: i })
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_machine_hour_rate", value: machineHourRate, line: i })
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_hour_rate", value: labourHoursRate, line: i })
          //     rec.setSublistValue({ sublistId: "item", fieldId: "custcol_ddc_labour_oh_rate", value: labourOhRate, line: i })
          // }

        }
      }
    }

    const parseFloatOrZero = n => parseFloat(n) || 0

    return {
      beforeSubmit: beforeSubmit,

    };

  });