/**
 * @name:                                       job_approval_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Wed Sep 21 2022 10:57:22 AM
 * Change Logs:
 * Date                          Author               Description
 * Wed Sep 21 2022 10:57:22 AM -- Patrick Lising -- Initial Creation
 * Tue Oct 4 2022 10:22:10 AM -- Patrick Lising -- Updated trigger instead of Approval, script will trigger upon creating the job. Also added setting of Start Date and Estimated End Date
 * 
 * 
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Job
 */

define(['N/record', 'N/search', 'N/runtime', './lodash.js'], function (record, search, runtime, _) {


  function upon_saving_afterSubmit(context) {

    try {
      log.debug({
        title: 'context.type',
        details: context.type
      })

      if (context.type == "delete") {
        return;
      }
      var jobRec = context.newRecord;

      var subsidiary = jobRec.getValue('subsidiary');
      log.debug("subsidiary", subsidiary);
      //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
      if (subsidiary != '2') {
        return;
      }


      var jobId = jobRec.id
      var projectField = jobRec.getValue({
        fieldId: 'job'
      })

      var customerId = jobRec.getValue({
        fieldId: 'entity'
      })
      var projectTaskArr = [];
      var itemArr = [];
      if (projectField) {
        projectTaskArr = getProjectTask(projectField);
        log.debug("projectTaskArr", projectTaskArr);
        if (projectTaskArr.length > 0) {
          for (var i = 0; i < projectTaskArr.length; i++) {
            record.submitFields({
              type: 'projecttask',
              id: projectTaskArr[i].projectTaskId,
              values: {
                'plannedwork': 0
              }
            })

          }
        }

      }
      log.debug({
        title: 'projectField',
        details: projectField
      })
    } catch (error) {

    }


    var lineCount = jobRec.getLineCount({
      sublistId: "item"
    })
    if (!projectField) {

      log.debug({
        title: "Create Project and Project Tasks",
        details: "No Project Set. Proceed to create Project and Project Tasks"
      })

      var campaignName = jobRec.getValue({
        fieldId: 'custbody_ddc_campaign_job_name'
      })

      var startEndDate = jobRec.getValue({
        fieldId: 'custbody_ddc_technology_to_commence'
      })

      var estimatedEndDate = jobRec.getValue({
        fieldId: 'custbody_ddc_production_to_commence'
      })

      //create Project
      var createProjectRec = record.create({
        type: record.Type.JOB
      })

      createProjectRec.setValue({
        fieldId: 'customform',
        value: 151
      })

      createProjectRec.setValue({
        fieldId: 'companyname',
        value: campaignName
      })

      createProjectRec.setValue({
        fieldId: 'parent',
        value: customerId
      })

      createProjectRec.setValue({
        fieldId: 'subsidiary',
        value: 2
      })

      createProjectRec.setValue({
        fieldId: 'projectexpensetype',
        value: -2
      })

      createProjectRec.setValue({
        fieldId: 'custentity_ddc_linked_transaction',
        value: jobId
      })

      if (startEndDate && estimatedEndDate) {
        createProjectRec.setValue({
          fieldId: 'startdate',
          value: startEndDate
        })

        createProjectRec.setValue({
          fieldId: 'projectedenddate',
          value: estimatedEndDate
        })
      }

      var projectId = createProjectRec.save()

      log.debug({
        title: "Project created",
        details: projectId
      })

      //create project tasks

      if (projectId) {



        //set Project ID on the Job

        record.submitFields({
          type: record.Type.SALES_ORDER,
          id: jobId,
          values: {
            'job': projectId
          }
        })

        for (var i = 0; i < lineCount; i++) {

          //store item description, qty in an itemArr

          var itemId = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "item",
            line: i
          })

          // var projectTask = jobRec.getSublistValue({
          //     sublistId: "item",
          //     fieldId: "custcol_ddc_item_project_task",
          //     line: i
          // })

          var itemLookup = search.lookupFields({
            type: 'item',
            id: itemId,
            columns: 'custitem_ddc_project_task_cb'
          })

          var projectTask = itemLookup.custitem_ddc_project_task_cb

          if (projectTask) {

            log.debug({
              title: "Item Project task is T",
              details: "item: " + itemId
            })

            var itemDesc = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "description",
              line: i
            })
            var isVariation = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "custcol_ddc_variation",
              line: i
            })
            var variationNumber = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "custcol_ddc_variation_number",
              line: i
            })
            var estimatedQty = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "custcol_ddc_estimated_qty",
              line: i
            })
            var department = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "department",
              line: i
            })
            var classLineSo = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "class",
              line: i
            })
            var itemCategory = jobRec.getSublistValue({
              sublistId: "item",
              fieldId: "custcol_ddc_item_category",
              line: i
            })
            if (itemDesc.includes('Overtime')) {
              itemArr.push({
                'itemId': itemId,
                'itemDesc': itemDesc,
                'estimatedQty': estimatedQty,
                'parentItem': (isVariation) ? (itemDesc.replace(' Overtime', '') + " - Variation " + variationNumber) : itemDesc.replace(' Overtime', ''),
                'department': department,
                'classLineSo': classLineSo,
                'itemCategory': itemCategory

              })
            } else {
              itemArr.push({
                'itemId': itemId,
                'itemDesc': itemDesc,
                'estimatedQty': estimatedQty,
                'parentItem': (isVariation) ? (itemDesc + " - Variation " + variationNumber) : itemDesc,
                'department': department,
                'classLineSo': classLineSo,
                'itemCategory': itemCategory
              })
            }

          }

        }

        log.debug({
          title: "itemArr values",
          details: "itemArr: " + JSON.stringify(itemArr)
        })

        //after pushing valid items into itemArr, check for overtime items and sum them up with the parent item

        var groupedArr = _.groupBy(itemArr, 'parentItem')
        var totalQty = 0;

        log.debug({
          title: 'groupedArr value',
          details: groupedArr
        })

        Object.keys(groupedArr).forEach((keys, keyIndex) => {
          log.debug({
            title: 'groupedArr Keys',
            details: keyIndex + ' || ' + keys
          })
          var totalQty = 0
          var department;
          var classLineSo;
          var itemCategory;
          groupedArr[keys].forEach((value, index) => {
            log.debug({
              title: 'object value',
              details: value
            })
            //
            department = value.department;
            classLineSo = value.classLineSo;
            itemCategory = value.itemCategory;
            //
            totalQty += value.estimatedQty
          })
          //after sum of totalQty

          //create Project Task for each Key
          var projTaskRecord = record.create({
            type: record.Type.PROJECT_TASK
          })
          // projTaskRecord.setValue({
          //     fieldId: 'customform',
          //     value: 153
          // })

          projTaskRecord.setValue({
            fieldId: 'company',
            value: projectId
          })

          projTaskRecord.setValue({
            fieldId: 'title',
            value: keys
          })

          projTaskRecord.setValue({
            fieldId: 'plannedwork',
            value: totalQty
          })
          //add 
          projTaskRecord.setValue({
            fieldId: 'custevent_ddc_department',
            value: department
          })
          //
          projTaskRecord.setValue({
            fieldId: 'custevent_ddc_project_task_class',
            value: classLineSo
          })
          //
          projTaskRecord.setValue({
            fieldId: 'custevent_ddc_task_category',
            value: itemCategory
          })

          var projectTaskId = projTaskRecord.save()

          log.debug({
            title: "created Project Task",
            details: "Project Task ID: " + projectTaskId
          })



        })
      }

    }
    else {
      log.debug("dkkkkkkkkkkkkkkk", 'dkmmmmmmmmmmmmmm')
      projectId = projectField
      for (var i = 0; i < lineCount; i++) {

        //store item description, qty in an itemArr

        var itemId = jobRec.getSublistValue({
          sublistId: "item",
          fieldId: "item",
          line: i
        })

        // var projectTask = jobRec.getSublistValue({
        //     sublistId: "item",
        //     fieldId: "custcol_ddc_item_project_task",
        //     line: i
        // })

        var itemLookup = search.lookupFields({
          type: 'item',
          id: itemId,
          columns: 'custitem_ddc_project_task_cb'
        })

        var projectTask = itemLookup.custitem_ddc_project_task_cb

        if (projectTask) {

          log.debug({
            title: "Item Project task is T",
            details: "item: " + itemId
          })

          var itemDesc = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "description",
            line: i
          })
          var isVariation = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_ddc_variation",
            line: i
          })
          var variationNumber = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_ddc_variation_number",
            line: i
          })
          var estimatedQty = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_ddc_estimated_qty",
            line: i
          })
          var department = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "department",
            line: i
          })
          var classLineSo = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "class",
            line: i
          })
          var itemCategory = jobRec.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_ddc_item_category",
            line: i
          })
          if (itemDesc.includes('Overtime')) {
            itemArr.push({
              'itemId': itemId,
              'itemDesc': itemDesc,
              'estimatedQty': estimatedQty,
              'parentItem': (isVariation) ? (itemDesc.replace(' Overtime', '') + " - Variation " + variationNumber) : itemDesc.replace(' Overtime', ''),
              'department': department,
              'classLineSo': classLineSo,
              'itemCategory': itemCategory

            })
          } else {
            itemArr.push({
              'itemId': itemId,
              'itemDesc': itemDesc,
              'estimatedQty': estimatedQty,
              'parentItem': (isVariation) ? (itemDesc + " - Variation " + variationNumber) : itemDesc,
              'department': department,
              'classLineSo': classLineSo,
              'itemCategory': itemCategory
            })
          }

        }

      }

      log.debug({
        title: "itemArr values",
        details: "itemArr: " + JSON.stringify(itemArr)
      })

      //after pushing valid items into itemArr, check for overtime items and sum them up with the parent item

      var groupedArr = _.groupBy(itemArr, 'parentItem')
      var totalQty = 0;

      log.debug({
        title: 'groupedArr value',
        details: groupedArr
      })

      Object.keys(groupedArr).forEach((keys, keyIndex) => {
        log.debug({
          title: 'groupedArr Keys',
          details: keyIndex + ' || ' + keys
        })
        var totalQty = 0
        var department;
        var classLineSo;
        var itemCategory;
        groupedArr[keys].forEach((value, index) => {
          log.debug({
            title: 'object value',
            details: value
          })
          //
          department = value.department;
          classLineSo = value.classLineSo;
          itemCategory = value.itemCategory;
          //
          totalQty += value.estimatedQty
        })
        //after sum of totalQty

        //create Project Task for each Key
        var id = projectTaskArr.filter(i => i.title == keys)
        log.debug("id", id);
        if (id.length > 0) {
          var projTaskRecord = record.load({
            type: record.Type.PROJECT_TASK,
            id: id[0].projectTaskId
          })
          log.debug("update project task ", id[0].projectTaskId)
        }
        else {
          var projTaskRecord = record.create({
            type: record.Type.PROJECT_TASK,
          })
        }

        // projTaskRecord.setValue({
        //     fieldId: 'customform',
        //     value: 153
        // })

        projTaskRecord.setValue({
          fieldId: 'company',
          value: projectId
        })

        projTaskRecord.setValue({
          fieldId: 'title',
          value: keys
        })

        projTaskRecord.setValue({
          fieldId: 'plannedwork',
          value: totalQty
        })
        //add 
        projTaskRecord.setValue({
          fieldId: 'custevent_ddc_department',
          value: department
        })
        //
        projTaskRecord.setValue({
          fieldId: 'custevent_ddc_project_task_class',
          value: classLineSo
        })
        //
        projTaskRecord.setValue({
          fieldId: 'custevent_ddc_task_category',
          value: itemCategory
        })

        var projectTaskId = projTaskRecord.save()

        log.debug({
          title: "created Project Task",
          details: "Project Task ID: " + projectTaskId
        })



      })
    }


  }
  function getProjectTask(jobID) {
    var ret = [];
    var jobSearchObj = search.create({
      type: "job",
      filters:
        [
          ["internalidnumber", "equalto", jobID.toString()]
        ],
      columns:
        [
          search.createColumn({
            name: "entityid",
            sort: search.Sort.ASC,
            label: "Project ID"
          }),
          search.createColumn({ name: "altname", label: "Project" }),
          search.createColumn({ name: "custentity_ddc_linked_transaction", label: "Job" }),
          search.createColumn({
            name: "title",
            join: "projectTask",
            label: "Project Task"
          }),
          search.createColumn({
            name: "plannedwork",
            join: "projectTask",
            label: "Planned Hours"
          })
          ,
          search.createColumn({
            name: "internalid",
            join: "projectTask",
            label: "Project Task Internal ID"
          })
        ]
    });
    var searchResultCount = jobSearchObj.runPaged().count;
    log.debug("searchResultCount", searchResultCount);
    var cols = jobSearchObj.columns;
    log.debug("jobSearchObj result count", searchResultCount);
    jobSearchObj.run().each(function (result) {
      var projectTaskId = result.getValue(cols[5]);
      var title = result.getValue(cols[3]);
      ret.push({
        projectTaskId: projectTaskId,
        title: title

      })
      return true;
    });
    return ret

  }
  return {
    afterSubmit: upon_saving_afterSubmit
  }
});