/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @Author: Rex Jean
 */

/**
 * @deployedto Vendor Bill
 * @deployedto Vendor Credit
 */

define([
  'N/record',
  'N/runtime',
  'N/url',
  'N/ui/serverWidget',
  'N/search'
], function (record, runtime, url, serverWidget, search) {

  function entityMapping(x) {
    return {
      name: x.getValue(x.columns[0]),
      primeSubsidiary: x.getValue(x.columns[1]),
      repSubsidiary: x.getValue(x.columns[2]),
      entityid: x.getValue(x.columns[3])
    }
  }

  function getEntity(subsidiaries) {

    var entitySrch = search.load({
      id: 'customsearch_inrercompany_venndor_crossc'
    })
    if (subsidiaries.length > 0) {
      entitySrch.filters.push(search.createFilter({
        name: "representingsubsidiary",
        operator: search.Operator.ANYOF,
        values: subsidiaries
      }))
    }

    var results = getResults(entitySrch.run());
    results = results.map(entityMapping)
    return results
  }

  /**
   * Retrieves all search results of an nlobjSearchResultSet
   * @param  {resultSet} set search result set to retrieve results
   * @return {Array}     array containing search results
   */
  var getResults = function getResults(set) {
    var holder = [];
    var i = 0;
    while (true) {
      var result = set.getRange({
        start: i,
        end: i + 1000
      });
      if (!result) break;
      holder = holder.concat(result);
      if (result.length < 1000) break;
      i += 1000;
    }
    return holder;
  };


  /**
    * Auto Create JE and auto Reverse JE
    * @param {object} context 
    * @param {string|object|*} context.type
    * @param {form} context.form
    * @param {request} context.request
    * @param {record} context.newRecord
    * @param {record} contextn.oldRecord
    */
  function deleteReference(context) {
    let currentRecord = context.newRecord;
    var scriptObj = runtime.getCurrentScript();

    log.error({
      title: 'context.type',
      details: context.type
    });
    if (context.type == context.UserEventType.DELETE) {
      const jeId = currentRecord.getValue('custbody_paired_je');

      try {
        let recordType = search.lookupFields({
          type: search.Type.TRANSACTION,
          id: jeId,
          columns: ['recordtype']
        })
        if (jeId) {
          record.delete({
            type: recordType.recordtype,
            id: jeId
          });
        }
        log.debug({ title: 'Updated Record ID', details: id });
      } catch (err) {
        log.debug({ title: 'Reverse JE Error', details: err });
      }
    }
  }

  /**
   * Auto Create Intercompany JE
   * @param {object} context 
   * @param {string|object|*} context.type
   * @param {form} context.form
   * @param {request} context.request
   * @param {record} context.newRecord
   * @param {record} contextn.oldRecord
   */
  function processJe(context) {
    let currentRecord = context.newRecord;
    const RECORDTYPE = currentRecord.type;
    const RECORDID = currentRecord.id;
    var scriptObj = runtime.getCurrentScript();

    log.error({
      title: 'context.type',
      details: context.type
    });

    try {
      const memo = currentRecord.getValue('memo') || '';
      const entity = currentRecord.getValue('entity');
      const trandate = currentRecord.getValue('trandate') || new Date();
      const postperiod = currentRecord.getValue('postingperiod');
      const currency = currentRecord.getValue('currency');
      const location = currentRecord.getValue('location');
      const classValue = currentRecord.getValue('class');
      const department = currentRecord.getValue('department');
      const subsidiary = currentRecord.getValue('subsidiary')
      const jeLinkId = currentRecord.getValue('custbody_paired_je')
      const exchangerate = currentRecord.getValue('exchangerate')
      log.error({
        title: 'exchangerate',
        details: exchangerate
      });

      let subsidiaries = [subsidiary];

      let lineCount = currentRecord.getLineCount('item')
      var indicator = true;
      if (context.type == context.UserEventType.CREATE || !jeLinkId) {
        indicator = true;
      } else if (context.type == context.UserEventType.DELETE) {
        return;
      } else {
        indicator = false;
      }
      let objRecord = indicator ? record.create({
        type: 'advintercompanyjournalentry',
        isDynamic: true,
        defaultValue: true
      }) : record.load({
        type: 'advintercompanyjournalentry',
        id: jeLinkId,
        isDynamic: true
      });
      objRecord.setValue({
        fieldId: 'custbody_paired_vendor_invoice',
        value: RECORDID
      })
      objRecord.setValue({
        fieldId: 'subsidiary',
        value: subsidiary
      })
      objRecord.setValue({
        fieldId: 'trandate',
        value: trandate
      });
      objRecord.setValue({
        fieldId: 'memo',
        value: memo
      });
      objRecord.setValue({
        fieldId: 'postingperiod',
        value: postperiod
      });
      objRecord.setValue({
        fieldId: 'currency',
        value: currency
      })
      objRecord.setValue({
        fieldId: 'approvalstatus',
        value: 2
      })
      var objRecordLineCount = objRecord.getLineCount("line")
      log.error({
        title: 'lineCount',
        details: lineCount
      });

      for (var i = 0; i < lineCount; i++) {
        subsidiaries.push(currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_rec_sub',
          line: i
        }))
      }

      let entities = getEntity(subsidiaries)

      log.error({
        title: 'entities',
        details: entities
      });
      let createJe = true;
      if (context.type == context.UserEventType.CREATE || !jeLinkId) {
      } else {
        for (let x = objRecordLineCount - 1; x >= 0; x--) {
          log.error({
            title: 'x',
            details: x
          });
          objRecord.removeLine({
            sublistId: 'line',
            line: x,
          });
        }
      }
      for (var i = 0; i < lineCount; i++) {
        var entityLine = 0;
        var departmentLine = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'department',
          line: i
        })
        var classLine = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'class',
          line: i
        })
        var locationLine = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_rec_loc',
          line: i
        })
        var itemLine = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i
        })
        var classLine = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'class',
          line: i
        })
        var linesubsidiary = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_rec_sub',
          line: i
        })
        if (!linesubsidiary) {
          log.error({
            title: 'test',
            details: 'test'
          });
          createJe = false
        }
        var amount = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'amount',
          line: i
        })
        var description = currentRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'description',
          line: i
        })
        description = description.length > 999 ? description.substring(0, 999) : description;
        log.error({
          title: 'to and from subsidiary',
          details: subsidiary + " " + linesubsidiary
        });
        log.error({
          title: 'description',
          details: description
        });
        let recordType = search.lookupFields({
          type: search.Type.ITEM,
          id: itemLine,
          columns: ['expenseaccount']
        })
        log.error({
          title: 'recordType',
          details: recordType + " : " + recordType.expenseaccount
        });
        objRecord.selectNewLine({
          sublistId: 'line'
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linesubsidiary',
          value: subsidiary
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: 119
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'duetofromsubsidiary',
          value: linesubsidiary
        })
        if (RECORDTYPE == 'vendorcredit') {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'credit',
            value: amount
          })
        } else {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'debit',
            value: amount
          })
        }
        entities.forEach(function (line) {
          log.error({
            title: 'line.repSubsidiary == linesubsidiary',
            details: line.repSubsidiary + " " + linesubsidiary
          });
          if (linesubsidiary == line.repSubsidiary) {
            entityLine = line.entityid
          }
        });
        log.error({
          title: 'entityLine',
          details: entityLine
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'entity',
          value: entityLine
        })
        // objRecord.setCurrentSublistValue({
        //     sublistId: 'line',
        //     fieldId: 'department',
        //     value: department
        // })
        // objRecord.setCurrentSublistValue({
        //     sublistId: 'line',
        //     fieldId: 'class',
        //     value: classValue
        // })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'location',
          value: location
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linefxrate',
          value: exchangerate
        })
        objRecord.commitLine({
          sublistId: 'line'
        })

        objRecord.selectNewLine({
          sublistId: 'line'
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linesubsidiary',
          value: subsidiary
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: recordType.expenseaccount[0].value
        })
        if (RECORDTYPE == 'vendorcredit') {

          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'debit',
            value: amount
          })
        } else {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'credit',
            value: amount
          })
        }

        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'department',
          value: departmentLine
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'memo',
          value: description
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'class',
          value: classLine
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'location',
          value: location
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linefxrate',
          value: exchangerate
        })
        objRecord.commitLine({
          sublistId: 'line'
        })

        log.error({
          title: 'to and from subsidiary',
          details: subsidiary + " " + linesubsidiary
        });
        objRecord.selectNewLine({
          sublistId: 'line'
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linesubsidiary',
          value: linesubsidiary
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: 111
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'duetofromsubsidiary',
          value: subsidiary
        })
        if (RECORDTYPE == 'vendorcredit') {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'debit',
            value: amount
          })
        } else {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'credit',
            value: amount
          })
        }
        entities.forEach(function (line) {
          log.error({
            title: 'linesubsidiary == line.repSubsidiary',
            details: linesubsidiary + " " + line.repSubsidiary + " : " + (linesubsidiary == line.repSubsidiary)
          });
          if (subsidiary == line.repSubsidiary) {
            log.error({
              title: 'linesubsidiaryset',
              details: linesubsidiary + " " + line.repSubsidiary
            });
            entityLine = line.entityid
          }
        });
        log.error({
          title: 'entityLine',
          details: entityLine
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'entity',
          value: entityLine
        })
        // objRecord.setCurrentSublistValue({
        //     sublistId: 'line',
        //     fieldId: 'department',
        //     value: departmentLine
        // })
        // objRecord.setCurrentSublistValue({
        //     sublistId: 'line',
        //     fieldId: 'class',
        //     value: classLine
        // })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'location',
          value: locationLine
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linefxrate',
          value: exchangerate
        })
        objRecord.commitLine({
          sublistId: 'line'
        })

        objRecord.selectNewLine({
          sublistId: 'line'
        });
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linesubsidiary',
          value: linesubsidiary
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: recordType.expenseaccount[0].value
        })
        if (RECORDTYPE == 'vendorcredit') {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'credit',
            value: amount
          })
        } else {
          objRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'debit',
            value: amount
          })
        }


        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'department',
          value: departmentLine
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'memo',
          value: description
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'class',
          value: classLine
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'location',
          value: locationLine
        })
        objRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'linefxrate',
          value: exchangerate
        })
        objRecord.commitLine({
          sublistId: 'line'
        })
      }
      log.error({
        title: 'createJe',
        details: createJe
      })
      var jeId = 0;
      if (createJe) {
        jeId = objRecord.save();
      }

      if (jeId) {
        log.error({
          title: 'JE Creation',
          details: 'SUCCESS'
        })
        try {
          var id = record.submitFields({
            type: RECORDTYPE,
            id: RECORDID,
            values: {
              'custbody_paired_je': jeId
            },
            options: {
              enableSourcing: false,
              ignoreMandatoryFields: true
            }
          });
        } catch (linkErr) {
          log.error({
            title: 'Linking Error',
            details: linkErr
          })
        }
      } else {
        log.error({
          title: 'JE Creation',
          details: 'FAIL'
        })
      }

    } catch (err) {
      log.error({
        title: 'JE Creation error',
        details: err
      })
    }

  }
  return {
    beforeSubmit: deleteReference,
    afterSubmit: processJe
  }
})