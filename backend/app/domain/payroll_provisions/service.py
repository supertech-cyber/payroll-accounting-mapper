from __future__ import annotations

from pathlib import Path

from app.domain.payroll_provisions.models import ProvisionEntry, ProvisionResult
from app.infrastructure.excel._shared import competence_to_display
from app.infrastructure.excel.provision_13th_reader import (
    _13thSnapshot,
    parse_single_13th_report,
)
from app.infrastructure.excel.provision_vacation_reader import (
    _VacationSnapshot,
    parse_single_vacation_report,
)


def _index_13th(
    snapshots: list[_13thSnapshot],
) -> dict[tuple[str, str], _13thSnapshot]:
    return {(s.company_code, s.cost_center_code): s for s in snapshots}


def _index_vacation(
    snapshots: list[_VacationSnapshot],
) -> dict[tuple[str, str], _VacationSnapshot]:
    return {(s.company_code, s.cost_center_code): s for s in snapshots}


def get_13th_provision_results(
    file_a: str | Path,
    file_b: str | Path,
) -> list[ProvisionResult]:
    snapshots_a = parse_single_13th_report(file_a)
    snapshots_b = parse_single_13th_report(file_b)

    if not snapshots_a or not snapshots_b:
        raise ValueError(
            "Não foi possível ler os dados de um dos relatórios de provisão de 13º."
        )

    comp_a = snapshots_a[0].competence
    comp_b = snapshots_b[0].competence

    if comp_a == comp_b:
        raise ValueError(
            "Os dois relatórios possuem a mesma competência. "
            "É necessário enviar competências diferentes."
        )

    if comp_a < comp_b:
        previous, current, comp_prev, comp_curr = (
            snapshots_a,
            snapshots_b,
            comp_a,
            comp_b,
        )
    else:
        previous, current, comp_prev, comp_curr = (
            snapshots_b,
            snapshots_a,
            comp_b,
            comp_a,
        )

    prev_idx = _index_13th(previous)
    curr_idx = _index_13th(current)
    display = competence_to_display(comp_curr)
    results: list[ProvisionResult] = []

    for key in sorted(set(prev_idx) | set(curr_idx)):
        prev = prev_idx.get(key)
        curr = curr_idx.get(key)
        base = curr or prev
        if base is None:
            continue

        p13 = prev.total_saldo_13th if prev else 0.0
        c13 = curr.total_saldo_13th if curr else 0.0
        pfgts = prev.total_saldo_fgts if prev else 0.0
        cfgts = curr.total_saldo_fgts if curr else 0.0
        pinss = (
            (prev.total_saldo_inss + prev.total_saldo_terc + prev.total_saldo_rat)
            if prev
            else 0.0
        )
        cinss = (
            (curr.total_saldo_inss + curr.total_saldo_terc + curr.total_saldo_rat)
            if curr
            else 0.0
        )

        results.append(
            ProvisionResult(
                company_code=base.company_code,
                company_name=base.company_name,
                company_cnpj=base.company_cnpj,
                company_cnpj_base=base.company_cnpj_base,
                competence_previous=comp_prev,
                competence_current=comp_curr,
                cost_center_code=base.cost_center_code,
                cost_center_name=base.cost_center_name,
                entries=[
                    ProvisionEntry(
                        "PROV13",
                        f"PROV13 {display}",
                        round(p13, 2),
                        round(c13, 2),
                        round(c13 - p13, 2),
                    ),
                    ProvisionEntry(
                        "PROVFGTS13",
                        f"PROVFGTS13 {display}",
                        round(pfgts, 2),
                        round(cfgts, 2),
                        round(cfgts - pfgts, 2),
                    ),
                    ProvisionEntry(
                        "PROVINSS13",
                        f"PROVINSS13 {display}",
                        round(pinss, 2),
                        round(cinss, 2),
                        round(cinss - pinss, 2),
                    ),
                ],
            )
        )

    return results


def get_vacation_provision_results(
    file_a: str | Path,
    file_b: str | Path,
) -> list[ProvisionResult]:
    snapshots_a = parse_single_vacation_report(file_a)
    snapshots_b = parse_single_vacation_report(file_b)

    if not snapshots_a or not snapshots_b:
        raise ValueError(
            "Não foi possível ler os dados de um dos relatórios de provisão de férias."
        )

    comp_a = snapshots_a[0].competence
    comp_b = snapshots_b[0].competence

    if comp_a == comp_b:
        raise ValueError("Os dois relatórios possuem a mesma competência.")

    if comp_a < comp_b:
        previous, current, comp_prev, comp_curr = (
            snapshots_a,
            snapshots_b,
            comp_a,
            comp_b,
        )
    else:
        previous, current, comp_prev, comp_curr = (
            snapshots_b,
            snapshots_a,
            comp_b,
            comp_a,
        )

    prev_idx = _index_vacation(previous)
    curr_idx = _index_vacation(current)
    display = competence_to_display(comp_curr)
    results: list[ProvisionResult] = []

    for key in sorted(set(prev_idx) | set(curr_idx)):
        prev = prev_idx.get(key)
        curr = curr_idx.get(key)
        base = curr or prev
        if base is None:
            continue

        pvac = (prev.total_saldo_vacation + prev.total_saldo_bonus) if prev else 0.0
        cvac = (curr.total_saldo_vacation + curr.total_saldo_bonus) if curr else 0.0
        pfgts = prev.total_saldo_fgts if prev else 0.0
        cfgts = curr.total_saldo_fgts if curr else 0.0
        pinss = (
            (prev.total_saldo_inss + prev.total_saldo_terc + prev.total_saldo_rat)
            if prev
            else 0.0
        )
        cinss = (
            (curr.total_saldo_inss + curr.total_saldo_terc + curr.total_saldo_rat)
            if curr
            else 0.0
        )

        results.append(
            ProvisionResult(
                company_code=base.company_code,
                company_name=base.company_name,
                company_cnpj=base.company_cnpj,
                company_cnpj_base=base.company_cnpj_base,
                competence_previous=comp_prev,
                competence_current=comp_curr,
                cost_center_code=base.cost_center_code,
                cost_center_name=base.cost_center_name,
                entries=[
                    ProvisionEntry(
                        "PROVFERIAS",
                        f"PROVFERIAS {display}",
                        round(pvac, 2),
                        round(cvac, 2),
                        round(cvac - pvac, 2),
                    ),
                    ProvisionEntry(
                        "PROVFGTSFERIAS",
                        f"PROVFGTSFERIAS {display}",
                        round(pfgts, 2),
                        round(cfgts, 2),
                        round(cfgts - pfgts, 2),
                    ),
                    ProvisionEntry(
                        "PROVINSSFERIAS",
                        f"PROVINSSFERIAS {display}",
                        round(pinss, 2),
                        round(cinss, 2),
                        round(cinss - pinss, 2),
                    ),
                ],
            )
        )

    return results
