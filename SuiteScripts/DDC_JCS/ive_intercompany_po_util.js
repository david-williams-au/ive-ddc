/**

JCSP Library
*/
define(["N/record",
  "N/log",
  "N/transaction",
  "N/search",
  "N/format"],
  Main);

function Main(
  record,
  log,
  transaction,
  search,
  format) {
  //const TRADECREDITORS = 243;
  const ICCACCTSPAYABLE = 111;
  //const TRADERECEIVABLE = 244;
  const ICCACCTSRECEIVABLE = 119;

  function getLineValue(line, params) {
    try {
      log.debug("params", params);
      var invID = params.invID;
      var invTotal = params.invTotal;
      var invSubs = params.invSubs;
      var invCust = params.invCust;
      var vbSubs = params.vbSubs;
      var vbEntity = params.vbEntity;
      var poTotal = params.poTotal
      var subs, account, debit, credit, name, elim, duesubs;
      if (line == 1) {
        subs = vbSubs
        debit = poTotal;
        credit = null;
        name = getRepresent('vendor', invSubs, vbEntity);
        elim = true;
        duesubs = invSubs;


      }

      if (line == 2) {
        subs = vbSubs
        debit = null;
        credit = poTotal;
        name = vbEntity
        elim = false;
        duesubs = null;
      }

      if (line == 3) {
        subs = getSubsidiary('invoice', invID);
        debit = null;
        credit = invTotal;
        name = getRepresent('customer', vbSubs, invCust);
        elim = true;
        duesubs = vbSubs;

      }

      if (line == 4) {
        subs = getSubsidiary('invoice', invID);
        debit = invTotal;
        credit = null;
        name = invCust;
        elim = false;
        duesubs = null;

      }

      account = getAccount(line, params);

      return new JELine(subs, account, debit, credit, name, elim, duesubs);

    } catch (ex) {
      log.debug({
        title: 'getLineValue ex',
        details: ex
      });
    }

  }

  function JELine(subs, account, debit, credit, name, elim, duesubs) {
    this.linesubsidiary = subs;
    this.account = account;
    this.debit = debit;
    this.credit = credit;
    this.entity = name;
    this.eliminate = elim;
    this.duetofromsubsidiary = duesubs;
  }

  function getAccount(line, params) {
    try {
      var account = null;
      if (line == 2) {
        account = getLoanAccount('vendor', params.vbEntity);
      } else if (line == 4) {
        account = getLoanAccount('customer', params.invCust);
      } else {
        var obj = {};
        obj[1] = ICCACCTSPAYABLE;
        //obj[2] = TRADECREDITORS;
        obj[3] = ICCACCTSRECEIVABLE;
        // obj[4] = TRADERECEIVABLE;
        account = obj[line];
        log.debug({
          title: 'getAccount: ' + line,
          details: account
        });
      }
      return account;
    } catch (e) {
      log.error("error @ getAccount", e);
    }
  }
  function getLoanAccount(type, entityId) {
    try {
      let entityRecordLookUp = search.lookupFields({
        type: type,
        id: entityId,
        columns: ['custentity_ive_ic_autobill_loan_acc']
      });

      return entityRecordLookUp.custentity_ive_ic_autobill_loan_acc[0].value;
    } catch (ex) {
      log.debug({
        title: 'getLoanAccount ex',
        details: ex
      });
      return null;
    }
  }

  function getSubsidiary(type, id) {
    var vals = search.lookupFields({
      type: type,
      id: id,
      columns: 'subsidiary'
    });
    return parseInt(vals.subsidiary[0].value);
  }

  function getRepresent(type, subid, entity) {
    try {
      var repSearch = search.create({
        type: type,
        filters:
          [
            ["representingsubsidiary", "anyof", subid],
            "AND",
            ["isinactive", "is", "F"],
            "AND",
            ["internalid", "anyof", entity]
          ],
        columns:
          [
            search.createColumn({
              name: "entityid"
            })
          ]
      });
      var searchResultCount = repSearch.runPaged().count;
      log.debug("repSearch result count", searchResultCount);
      var val = null;
      repSearch.run().each(function (result) {
        val = result.id;
        return true;
      });
      return val;
    } catch (ex) {
      log.debug({
        title: 'getRepresent ex',
        details: ex
      });
    }
  }

  return {
    getAccount: getAccount,
    getSubsidiary: getSubsidiary,
    JELine: JELine,
    getLineValue: getLineValue

  };
}