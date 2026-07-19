const barberBusiness = require("../data/business.json");

// This storage boundary keeps route code independent from JSON files. Replace
// this implementation with a database query later without changing callers.
async function getBusinessData(businessType) {
  if (businessType !== barberBusiness.businessType) {
    return null;
  }

  return barberBusiness;
}

module.exports = { getBusinessData };
