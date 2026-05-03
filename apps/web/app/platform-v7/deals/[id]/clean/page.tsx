// PATCH: deal release must respect release guard

const releaseAmountRaw = releaseCheck?.releaseAmount ?? deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
const canRelease = releaseCheck ? releaseCheck.canRequestRelease : true;
const releaseAmount = canRelease ? releaseAmountRaw : 0;
