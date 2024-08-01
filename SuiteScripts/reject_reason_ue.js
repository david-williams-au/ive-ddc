/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * @deployedto Bank Details
 * @deployedto Vendor
 * @deployedto Vendor Bill
 */

define(['N/record', 'N/runtime', 'N/search', 'N/task'],
  /**
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{task} task
 */
  (record, runtime, search, task) => {
    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const DISTRIBUTION_CONTRACTOR_CATEGORY = 8
    const REJECT_REASON = 'Missing Bank Details on Vendor'

    const afterSubmit = (scriptContext) => {
      let { oldRecord, newRecord } = scriptContext
      let { type, id } = newRecord

      if (((type == 'vendor' || type == 'vendorbill') && scriptContext.type == 'delete') || (type == 'vendorbill' && scriptContext.type == 'xedit'))
        return

      let entityId = (() => {
        let _id = ''
        if (type == 'vendor')
          _id = id
        else if (type == 'vendorbill') {
          _id = newRecord.getValue({ fieldId: 'entity' }) // Returns null when xedit
          if (!_id) {
            log.debug('Lookedup vendorbill entity')
            let lookUp = search.lookupFields({ type: 'vendorbill', id, columns: ['entity'] })
            if (lookUp.entity.length)
              _id = lookUp.entity[0].value
          }
        } else {
          _id = newRecord.getValue({ fieldId: 'custrecord_2663_parent_vendor' }) // Returns null when xedit
          if (!_id) {
            log.debug('Lookedup custrecord_2663_parent_vendor entity')
            let lookUp = search.lookupFields({ type, id, columns: ['custrecord_2663_parent_vendor'] })
            if (lookUp.custrecord_2663_parent_vendor.length)
              _id = lookUp.custrecord_2663_parent_vendor[0].value
          }
        }
        return _id
      })();

      if (!entityId)
        return

      log.debug('-------- [START] --------', { type, id, entityId, eventType: scriptContext.type, execCtx: runtime.executionContext })

      let catchedBills = []

      try {
        let script = runtime.getCurrentScript()
        let xFilters = [
          ["isinactive", "is", "F"],
          "AND",
          ["custrecord_2663_entity_bank_type", "anyof", "1"], // Primary
          'AND',
          ['custrecord_2663_entity_acct_no', 'isnotempty', ''],
          'AND',
          ['custrecord_2663_parent_vendor', 'anyof', entityId]
        ]
        let bankSS = search.create({
          type: "customrecord_2663_entity_bank_details",
          filters: xFilters,
          columns:
            [
              search.createColumn({
                name: "internalid",
                join: "CUSTRECORD_2663_PARENT_VENDOR",
                label: "Vendor.Internal ID"
              }),
              search.createColumn({ name: "custrecord_2663_parent_vendor", label: "Parent Vendor" }),
              search.createColumn({ name: "custrecord_2663_entity_bank_type", label: "Type" }),
              search.createColumn({ name: "custrecord_2663_entity_bank_no", label: "Bank Number" }),
              search.createColumn({ name: "custrecord_2663_entity_branch_no", label: "Branch Number" }),
              search.createColumn({ name: "custrecord_2663_entity_acct_name", label: "Bank Account Name" }),
              search.createColumn({ name: "custrecord_2663_entity_acct_no", label: "Bank Account Number" }),
              search.createColumn({ name: "custrecord_2663_entity_payment_desc", label: "Bank Account Payment Description" }),
              search.createColumn({ name: "custrecord_2663_entity_bic", label: "BIC" }),
              search.createColumn({ name: "custrecord_2663_entity_country", label: "Country" }),
              search.createColumn({ name: "custrecord_2663_entity_country_check", label: "Country Check" }),
              search.createColumn({ name: "custrecord_2663_entity_country_code", label: "Country Code" })
            ]
        });
        let bankDetails = bankSS.run().getRange(0, 1)
        log.debug('Bank details length', bankDetails.length)

        var vendorbillSearchObj = search.create({
          type: "vendorbill",
          filters: type.match(/customrecord_2663_entity_bank_details|vendorbill/gi) ? [
            ["type", "anyof", "VendBill"],
            "AND",
            ["vendor.category", "anyof", DISTRIBUTION_CONTRACTOR_CATEGORY],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["memorized", "is", "F"],
            "AND",
            ["custbody_payment_status", "anyof", ["1", "2"]], // Only diff
            "AND",
            ["amountremaining", "greaterthan", "0.00"],
            "AND",
            ["custbody_sent_to_sftp", "is", "F"],
            "AND",
            ["mainname", "anyof", entityId],
          ] : [
            ["type", "anyof", "VendBill"],
            "AND",
            ["vendor.category", "anyof", DISTRIBUTION_CONTRACTOR_CATEGORY],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["memorized", "is", "F"],
            "AND",
            ["custbody_payment_status", "anyof", "1"], // Only diff 
            "AND",
            ["amountremaining", "greaterthan", "0.00"],
            "AND",
            ["custbody_sent_to_sftp", "is", "F"],
            "AND",
            ["mainname", "anyof", entityId],
          ],
          columns:
            [
              search.createColumn({ name: "tranid", label: "Document Number" }),
              search.createColumn({ name: "transactionnumber", label: "Transaction Number" }),
              search.createColumn({ name: "trandate", label: "Date" }),
              search.createColumn({ name: "datecreated", label: "Date Created" }),
              search.createColumn({ name: "custbody_reject_reason_details", label: "Reject Reason Details" })
            ]
        });
        var searchResultCount = vendorbillSearchObj.runPaged().count;
        log.debug("vendorbillSearchObj result count", searchResultCount);

        let bills = []

        vendorbillSearchObj.run().each(function (result) {
          let reject_reason = result.getValue({ name: 'custbody_reject_reason_details' }) || ''
          let statusId = 1 // Pending
          if (!bankDetails.length) {
            if (!reject_reason.match(new RegExp(REJECT_REASON, 'gi'))) { // If has no {REJECT_REASON} match from var reject_reason
              if (reject_reason)
                reject_reason += `\n${REJECT_REASON}`
              else
                reject_reason += REJECT_REASON
            }
          } else
            reject_reason = reject_reason.replace(new RegExp(`\n${REJECT_REASON}|${REJECT_REASON}`, 'gi'), '') // Remove {REJECT_REASON} occurences from var reject_reason

          if (reject_reason.match(new RegExp(REJECT_REASON, 'gi')))
            statusId = 2 // Reject

          bills.push({
            id: result.id,
            tranid: result.getValue({ name: 'tranid' }),
            reason: reject_reason,
            status: statusId
          })
          return true;
        });

        for (bill of bills) {
          if (script.getRemainingUsage() >= 50) {
            try {
              record.submitFields({
                type: 'vendorbill',
                id: bill.id,
                values: {
                  custbody_payment_status: bill.status,
                  custbody_reject_reason_details: bill.reason
                },
                options: {
                  ignoreMandatoryFields: true,
                }
              })
              log.debug('Updated bill', { bill, remainingUsage: script.getRemainingUsage() })
            } catch (e) {
              log.debug('Error updating bill', { bill, remainingUsage: script.getRemainingUsage(), errorMsg: e.message })
            }
          } else {
            catchedBills.push(bill)
          }
        }

        if (catchedBills.length) {
          task.create({
            taskType: task.TaskType.MAP_REDUCE,
            params: {
              custscript_catched_bills: JSON.stringify(catchedBills)
            },
            scriptId: 'customscript_reject_reason_mr'
          }).submit()
        }
      } catch (e) {
        log.debug('Error Aftersubmit', e.message)
      }
      log.debug('-------- [END] --------', { catchedBills, remaningUsage: runtime.getCurrentScript().getRemainingUsage() })
    }

    return { afterSubmit }

  });