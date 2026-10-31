package com.agriweather.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 新建地块请求。
 *
 * 可选项为空表示「未填写」，不要用 0 代替；面积由边界可算时以服务端计算为准。
 * 修改接口是部分更新，字段是否出现有语义，仍由控制器按 Map 处理。
 */
@Data
public class FarmlandRequest {

    @NotBlank(message = "请填写地块名称")
    @Size(max = 100, message = "地块名称不能超过 100 个字符")
    private String fieldName;

    @NotNull(message = "请填写纬度")
    @DecimalMin(value = "-90", message = "纬度需在 -90 ~ 90 之间")
    @DecimalMax(value = "90", message = "纬度需在 -90 ~ 90 之间")
    private Double lat;

    @NotNull(message = "请填写经度")
    @DecimalMin(value = "-180", message = "经度需在 -180 ~ 180 之间")
    @DecimalMax(value = "180", message = "经度需在 -180 ~ 180 之间")
    private Double lng;

    @DecimalMin(value = "-500", message = "海拔需在 -500 ~ 9000 米之间")
    @DecimalMax(value = "9000", message = "海拔需在 -500 ~ 9000 米之间")
    private Double altitude;

    /** 亩；为空表示未知。有边界时由服务端按边界重算，忽略此值 */
    @DecimalMin(value = "0.01", message = "面积需大于 0")
    @DecimalMax(value = "1000000", message = "面积过大，请确认单位是否为亩")
    private Double areaMu;

    @Size(max = 30, message = "土壤类型不能超过 30 个字符")
    private String soilType;

    private Long cropId;

    /** YYYY-MM-DD；为空表示未填写 */
    private String plantDate;

    @Size(max = 20, message = "灌溉方式不能超过 20 个字符")
    private String irrigationType;

    /** 边界：[{lat,lng}] 数组或其 JSON 字符串；为空表示只有中心点 */
    private JsonNode boundary;
}