package com.agriweather.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FarmlandSeasonRequest {

    @Size(max = 50, message = "季名不能超过 50 个字符")
    private String seasonName;

    private Long cropId;

    /** YYYY-MM-DD */
    private String plantDate;

    private String expectedHarvestDate;

    private String harvestDate;

    @Pattern(regexp = "PLANTED|HARVESTED|FALLOW", message = "状态只能是 PLANTED/HARVESTED/FALLOW")
    private String status = "PLANTED";

    @Size(max = 500, message = "备注不能超过 500 个字符")
    private String notes;
}