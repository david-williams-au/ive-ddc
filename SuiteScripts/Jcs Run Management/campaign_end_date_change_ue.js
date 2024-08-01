/**
 * 
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Job
 */

define(['N/record', 'N/search', 'N/runtime', './moment.js'], function (record, search, runtime, moment) {


  function afterSubmit(context) {
    const newRecord = context.newRecord;

    //#region 📜 Sales Order | Skip Locked Record
    if ([record.Type.SALES_ORDER].includes(newRecord.type) && runtime.executionContext == runtime.ContextType.WEBSERVICES) {
      let custbody_ddc_job_locked = newRecord.getValue('custbody_ddc_job_locked');
      if (custbody_ddc_job_locked) {
        return;
      }
    }
    //#endregion

    try {
      var statusRunDetailCancel = 8
      var statusRunCancel = 7
      if (context.type == "edit") {
        log.debug("context", context);
        var newRec = context.newRecord;
        var oldRec = context.oldRecord;
        var id = context.newRecord.id;
        log.debug('id', id);
        var subsidiary = newRec.getValue('subsidiary');
        log.debug("subsidiary", subsidiary);
        if (subsidiary != '2') {
          return;
        }
        var endDateChange = newRec.getValue('custbody_ddc_campaign_end_date_changed')
        if (!endDateChange) {
          return;
        }
        var endDateNew = newRec.getText('custbody_ddc_end_date');
        log.debug("endDateNew", endDateNew)
        endDateNewArr = endDateNew.split('/')
        endDateNew = endDateNewArr[0] + '-' + endDateNewArr[1] + "-" + endDateNewArr[2]
        var endDateOld = oldRec.getText('custbody_ddc_end_date');
        log.debug("endDateOld", endDateOld)
        if (endDateNew == endDateOld) {
          return;
        }
        record.submitFields({
          type: 'salesorder',
          id: id,
          values: {
            "custbody_ddc_campaign_end_date_changed": true
          }

        })
        var internalIdRunArr = getRun(id, endDateNew);
        log.debug("internalIdRunArr", internalIdRunArr);
        for (var j = 0; j < internalIdRunArr.length; j++) {
          record.submitFields({
            type: 'customrecord_ddc_run',
            id: internalIdRunArr[j],
            values: {
              "custrecord_ddc_run_status": statusRunCancel
            }

          })
        }
        if (internalIdRunArr.length > 0) {
          var runDetail = getRunDetail(internalIdRunArr);
          for (var j = 0; j < runDetail.length; j++) {
            record.submitFields({
              type: 'customrecord_ddc_run_detail',
              id: runDetail[j].internalId,
              values: {
                "custrecord_ddc_rd_status": statusRunDetailCancel
              }

            })
          }
          record.submitFields({
            type: 'salesorder',
            id: id,
            values: {
              "custbody_ddc_campaign_end_date_changed": false
            }

          })
        }


      }

    } catch (error) {
      log.debug("error", error)
    }


  }
  function getRunDetail(runParent) {
    var ret = [];
    var runDetailSearch = search.create({
      type: "customrecord_ddc_run_detail",
      filters:
        [
          ["custrecord_ddc_rd_parent_run", "anyof", runParent]
        ],
      columns:
        [
          search.createColumn({ name: "internalid", label: "Internal ID" }),

        ]
    });
    var searchResultCount = runDetailSearch.runPaged().count;
    log.debug("run detail count", searchResultCount);
    if (runDetailSearch) {
      var ssResult = getAllResults(runDetailSearch);
      for (var i = 0; i < ssResult.length; i++) {
        var internalId = ssResult[i].id;
        ret.push({
          internalId: internalId,

        });
      }
    }
    else {
      log.debug(waJcurce, ' Return Null, Search issue');
      return [];
    }
    return ret;
  }
  function getAllResults(search) {
    var results = [];
    var pgSize = 1000;
    var r = search.runPaged({ pageSize: pgSize });
    var numPage = r.pageRanges.length;
    var searchPage;
    var ssResult;
    for (var np = 0; np < numPage; np++) {
      searchPage = r.fetch({ index: np });
      ssResult = searchPage.data;
      if (ssResult != undefined && ssResult != null && ssResult != '') {
        results = results.concat(ssResult);
      }
    }
    return results;
  }
  function getRun(id, endDateNew) {
    log.debug("dddddddddddddddddddd", endDateNew);
    var date = moment(endDateNew, 'DD-MM-YYYY');
    log.debug("date", date)
    var ret = [];
    var runSearch = search.create({
      type: "customrecord_ddc_run",
      filters:
        [
          ["custrecord_ddc_run_job", "anyof", id]
        ],
      columns:
        [
          search.createColumn({ name: "internalid", label: "Internal ID" }),
          search.createColumn({ name: "custrecord_ddc_run_planned_startdate", label: "Planned Start Date" })
        ]
    });
    var searchResultCount = runSearch.runPaged().count;
    log.debug("runSearch count", searchResultCount);
    runSearch.run().each(function (result) {
      var internalId = result.id;
      var startDate = result.getValue('custrecord_ddc_run_planned_startdate');
      startDate = startDate.split(' ')[0]
      var starDateArr = startDate.split('/');
      startDate = starDateArr[0] + '-' + starDateArr[1] + "-" + starDateArr[2]
      startDate = moment(startDate, 'DD-MM-YYYY');
      ret.push({
        internalId: internalId,
        startDate: startDate
      })
      return true;
    });
    log.debug("ret", ret);
    ret = ret.filter(x => moment(date).isSameOrBefore(moment(moment(x.startDate))));
    log.debug("ret pass", ret);
    var internalIDArr = ret.map(x => x.internalId);
    log.debug("internalIDArr", internalIDArr);
    return internalIDArr;
  }

  return {
    afterSubmit: afterSubmit
  }
});