package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** 完成当前种植季，并可选地立即开始下一季/换茬 */
@Data
public class SeasonCompleteRequest {

    /** 新一季作物；为空时沿用当前季作物 */
    private Long cropId;

    @NotBlank(message = "请填写新一季的播种日期")
    private String plantDate;

    @Size(max = 50, message = "季名不能超过 50 个字符")
    private String seasonName;

    /** 可选：新一季的种植计划文档 */
    private Long planDocumentId;

    @Size(max = 255)
    private String planName;
}